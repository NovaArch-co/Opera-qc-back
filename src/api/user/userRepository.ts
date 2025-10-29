import type { User as ModelUser } from "@/api/user/userModel";
import prisma from "@/common/utils/prisma";
import bcrypt from 'bcryptjs';

export class UserRepository {
  async findAllAsync(): Promise<ModelUser[]> {
    const rows = await prisma.user.findMany();
    // Map Prisma User -> ModelUser (the project uses a slightly different shape in places)
    return rows.map((r: any) => ({
      id: r.id,
      name: r.name ?? r.email,
      username: r.email,
      evaluatorName: (r as any).evaluatorName ?? '',
      sessionId: (r as any).sessionId ?? '',
      email: r.email,
      isActive: (r as any).isActive ?? false,
      isVerified: (r as any).isVerified ?? false,
      createdAt: (r as any).createdAt ?? new Date(),
      updatedAt: (r as any).updatedAt ?? new Date(),
    } as ModelUser));
  }

  async findByIdAsync(id: number): Promise<ModelUser | null> {
    const r = await prisma.user.findUnique({ where: { id } as any });
    if (!r) return null;
    return {
      id: r.id,
      name: r.name ?? r.email,
      username: r.email,
      evaluatorName: (r as any).evaluatorName ?? '',
      sessionId: (r as any).sessionId ?? '',
      email: r.email,
      isActive: (r as any).isActive ?? false,
      isVerified: (r as any).isVerified ?? false,
      createdAt: (r as any).createdAt ?? new Date(),
      updatedAt: (r as any).updatedAt ?? new Date(),
    } as ModelUser;
  }

  async createAsync(data: Partial<ModelUser>): Promise<ModelUser> {
    // hash the password before storing
    const rawPassword = (data as any).password ?? 'changeme';
    const hashed = bcrypt.hashSync(String(rawPassword), bcrypt.genSaltSync());
    const created = await prisma.user.create({
      data: {
        email: data.email ?? (data.username as any) ?? `user_${Date.now()}@example.com`,
        name: data.name ?? undefined,
        password: hashed,
        isVerified: (data as any).isVerified ?? false,
      } as any
    });
    return {
      id: created.id,
      name: created.name ?? created.email,
      username: created.email,
      evaluatorName: '',
      sessionId: '',
      email: created.email,
      isActive: (created as any).isActive ?? false,
      isVerified: (created as any).isVerified ?? false,
      createdAt: (created as any).createdAt ?? new Date(),
      updatedAt: (created as any).updatedAt ?? new Date(),
    } as ModelUser;
  }

  async updateAsync(id: number, data: Partial<ModelUser>): Promise<ModelUser | null> {
    try {
      // If password provided, hash it before update
      const updateData: any = {
        name: data.name ?? undefined,
        email: data.email ?? undefined,
        isVerified: (data as any).isVerified ?? undefined,
      };
      if ((data as any).password) {
        updateData.password = bcrypt.hashSync(String((data as any).password), bcrypt.genSaltSync());
      }
      const updated = await prisma.user.update({
        where: { id } as any,
        data: updateData as any,
      });
      return {
        id: updated.id,
        name: updated.name ?? updated.email,
        username: updated.email,
        evaluatorName: '',
        sessionId: '',
        email: updated.email,
        isActive: (updated as any).isActive ?? false,
        isVerified: (updated as any).isVerified ?? false,
        createdAt: (updated as any).createdAt ?? new Date(),
        updatedAt: (updated as any).updatedAt ?? new Date(),
      } as ModelUser;
    } catch (e) {
      return null;
    }
  }

  async deleteAsync(id: number): Promise<boolean> {
    try {
      await prisma.user.delete({ where: { id } as any });
      return true;
    } catch (e) {
      return false;
    }
  }

  async toggleActiveAsync(id: number): Promise<ModelUser | null> {
    const u = await prisma.user.findUnique({ where: { id } as any });
    if (!u) return null;
    // If `isActive` doesn't exist on Prisma model, toggle `isVerified` as closest boolean field.
    // Prefer updating a real 'isActive' column if your schema contains one.
    const toggled = await prisma.user.update({ where: { id } as any, data: { isVerified: !((u as any).isVerified ?? false) } as any });
    return {
      id: toggled.id,
      name: toggled.name ?? toggled.email,
      username: toggled.email,
      evaluatorName: '',
      sessionId: '',
      email: toggled.email,
      isActive: (toggled as any).isActive ?? false,
      isVerified: (toggled as any).isVerified ?? false,
      createdAt: (toggled as any).createdAt ?? new Date(),
      updatedAt: (toggled as any).updatedAt ?? new Date(),
    } as ModelUser;
  }
}

export const userRepository = new UserRepository();
