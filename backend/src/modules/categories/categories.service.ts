import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';

// Selección fija: nunca devolvemos campos que el cliente no necesita.
const CATEGORY_SELECT = {
  id: true,
  name: true,
  userId: true,
} as const;

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Crear ────────────────────────────────────────────────────────────────

  async create(userId: string, dto: CreateCategoryDto) {
    try {
      return await this.prisma.category.create({
        data: { name: dto.name, userId },
        select: CATEGORY_SELECT,
      });
    } catch (error) {
      // Prisma lanza P2002 cuando viola una restricción UNIQUE.
      // El schema define @@unique([name, userId]), así que solo falla
      // si ESTE usuario ya tiene una categoría con ese nombre exacto.
      if (
        error instanceof PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          `Ya tienes una categoría llamada "${dto.name}"`,
        );
      }
      throw error; // cualquier otro error lo propagamos sin envolver
    }
  }

  // ─── Listar todas (del usuario autenticado) ───────────────────────────────

  findAll(userId: string) {
    return this.prisma.category.findMany({
      where: { userId },
      select: CATEGORY_SELECT,
      orderBy: { name: 'asc' }, // alfabético → más cómodo para el selector de UI
    });
  }

  // ─── Verificar ownership (reutilizado en delete) ──────────────────────────

  private async findOwnOrFail(userId: string, categoryId: string) {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
      select: CATEGORY_SELECT,
    });

    if (!category) {
      throw new NotFoundException(
        `Categoría con id '${categoryId}' no encontrada`,
      );
    }
    if (category.userId !== userId) {
      throw new ForbiddenException(
        'No tienes permiso para modificar esta categoría',
      );
    }

    return category;
  }

  // ─── Eliminar ─────────────────────────────────────────────────────────────

  async remove(userId: string, categoryId: string) {
    await this.findOwnOrFail(userId, categoryId);

    try {
      await this.prisma.category.delete({ where: { id: categoryId } });
    } catch (error) {
      // P2003 → violación de FK: la categoría tiene transacciones asociadas.
      // El schema define onDelete: Restrict en Transaction → Category,
      // lo que impide borrar una categoría en uso. Convertimos el error
      // técnico de Prisma en una respuesta HTTP comprensible.
      if (
        error instanceof PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new ConflictException(
          'No puedes eliminar esta categoría porque tiene transacciones asociadas. ' +
            'Reasigna o elimina las transacciones primero.',
        );
      }
      throw error;
    }

    return { message: `Categoría '${categoryId}' eliminada correctamente` };
  }

  // ─── Seed de categorías por defecto ───────────────────────────────────────
  // Método utilitario que otros servicios pueden llamar al crear un usuario nuevo.
  // Usa createMany con skipDuplicates para ser idempotente.

  async seedDefaults(userId: string) {
    const defaults = [
      'Alimentación',
      'Transporte',
      'Vivienda',
      'Salud',
      'Entretenimiento',
      'Educación',
      'Ropa',
      'Servicios',
      'Inversiones',
      'Otros',
    ];

    await this.prisma.category.createMany({
      data: defaults.map((name) => ({ name, userId })),
      skipDuplicates: true, // si ya existen, no falla ni duplica
    });
  }
}
