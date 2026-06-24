import { supabase } from '../lib/supabase';
import { HttpError } from '../middleware/errorHandler';
import type { Database } from '../types/database.types';

type Admin = Database['public']['Tables']['admins']['Row'];
type AdminInsert = Database['public']['Tables']['admins']['Insert'];
type AdminUpdate = Database['public']['Tables']['admins']['Update'];

const NO_ROWS = 'PGRST116';

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizeOptionalString(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

export const adminService = {
  async getAll(): Promise<Admin[]> {
    const { data, error } = await supabase
      .from('admins')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw new HttpError(500, error.message);
    return data ?? [];
  },

  async getById(id: number): Promise<Admin | null> {
    const { data, error } = await supabase
      .from('admins')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === NO_ROWS) return null;
      throw new HttpError(500, error.message);
    }
    return data;
  },

  async findByEmail(email: string, excludeId?: number): Promise<Admin | null> {
    const normalized = normalizeEmail(email);
    let query = supabase
      .from('admins')
      .select('*')
      .ilike('email', normalized);

    if (excludeId != null) {
      query = query.neq('id', excludeId);
    }

    const { data, error } = await query.maybeSingle();

    if (error) throw new HttpError(500, error.message);
    return data;
  },

  async create(payload: AdminInsert): Promise<Admin> {
    const email = normalizeOptionalString(payload.email ?? undefined);
    if (!email) {
      throw new HttpError(400, 'email is required');
    }

    const existing = await this.findByEmail(email);
    if (existing) {
      throw new HttpError(409, 'An admin with this email already exists');
    }

    const insertPayload: AdminInsert = {
      email: normalizeEmail(email),
      first_name: normalizeOptionalString(payload.first_name ?? undefined),
      last_name: normalizeOptionalString(payload.last_name ?? undefined),
      isactive: payload.isactive ?? true,
    };

    const { data, error } = await supabase
      .from('admins')
      .insert(insertPayload)
      .select()
      .single();

    if (error) throw new HttpError(500, error.message);
    return data;
  },

  async update(id: number, payload: AdminUpdate): Promise<Admin | null> {
    const existing = await this.getById(id);
    if (!existing) return null;

    const updatePayload: AdminUpdate = {};

    if (payload.email !== undefined) {
      const email = normalizeOptionalString(payload.email ?? undefined);
      if (!email) {
        throw new HttpError(400, 'email is required');
      }

      const duplicate = await this.findByEmail(email, id);
      if (duplicate) {
        throw new HttpError(409, 'An admin with this email already exists');
      }

      updatePayload.email = normalizeEmail(email);
    }

    if (payload.first_name !== undefined) {
      updatePayload.first_name = normalizeOptionalString(payload.first_name ?? undefined);
    }

    if (payload.last_name !== undefined) {
      updatePayload.last_name = normalizeOptionalString(payload.last_name ?? undefined);
    }

    if (payload.isactive !== undefined) {
      updatePayload.isactive = payload.isactive;
    }

    if (payload.last_login !== undefined) {
      updatePayload.last_login = payload.last_login;
    }

    const { data, error } = await supabase
      .from('admins')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === NO_ROWS) return null;
      throw new HttpError(500, error.message);
    }
    return data;
  },

  async remove(id: number): Promise<void> {
    const existing = await this.getById(id);
    if (!existing) {
      throw new HttpError(404, 'Admin not found');
    }

    const { error } = await supabase.from('admins').delete().eq('id', id);

    if (error) throw new HttpError(500, error.message);
  },

  async authorize(
    email: string,
    name?: string,
  ): Promise<{ allowed: boolean; admin?: Admin; message?: string }> {
    const normalized = normalizeEmail(email);
    if (!normalized) {
      return { allowed: false, message: 'email is required' };
    }

    if (!normalized.endsWith('@calpoly.edu')) {
      return { allowed: false, message: 'Only @calpoly.edu accounts are allowed' };
    }

    const admin = await this.findByEmail(normalized);
    if (!admin || !admin.isactive) {
      return { allowed: false, message: 'User is not an active admin' };
    }

    const updatePayload: AdminUpdate = {
      last_login: new Date().toISOString(),
    };

    if (name && !admin.first_name && !admin.last_name) {
      const parts = name.trim().split(/\s+/);
      updatePayload.first_name = parts[0] ?? null;
      updatePayload.last_name =
        parts.length > 1 ? parts.slice(1).join(' ') : null;
    }

    const updated = await this.update(admin.id, updatePayload);
    return { allowed: true, admin: updated ?? admin };
  },
};
