import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CategoryResponseDto } from './dto/category-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Categories')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  // ─── POST /api/v1/categories ──────────────────────────────────────────────

  @Post()
  @ApiOperation({ summary: 'Crear una nueva categoría' })
  @ApiCreatedResponse({ type: CategoryResponseDto, description: 'Categoría creada' })
  @ApiConflictResponse({ description: 'Ya existe una categoría con ese nombre para este usuario' })
  create(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateCategoryDto,
  ): Promise<CategoryResponseDto> {
    return this.categoriesService.create(user.id, dto);
  }

  // ─── GET /api/v1/categories ───────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'Listar todas las categorías del usuario autenticado' })
  @ApiOkResponse({ type: [CategoryResponseDto] })
  findAll(
    @CurrentUser() user: { id: string },
  ): Promise<CategoryResponseDto[]> {
    return this.categoriesService.findAll(user.id);
  }

  // ─── DELETE /api/v1/categories/:id ───────────────────────────────────────

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Eliminar una categoría',
    description:
      'Falla con 409 si la categoría tiene transacciones asociadas ' +
      '(restricción onDelete: Restrict definida en el schema de Prisma).',
  })
  @ApiOkResponse({ schema: { example: { message: 'Categoría eliminada correctamente' } } })
  @ApiNotFoundResponse({ description: 'Categoría no encontrada' })
  @ApiForbiddenResponse({ description: 'La categoría pertenece a otro usuario' })
  @ApiConflictResponse({ description: 'La categoría tiene transacciones asociadas' })
  remove(
    @CurrentUser() user: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.categoriesService.remove(user.id, id);
  }
}
