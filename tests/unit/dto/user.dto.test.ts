import { createUserSchema, updateUserSchema } from '../../../src/core/application/dto/user.dto';

describe('user.dto — restricción del rol OWNER', () => {
  const validBase = {
    name: 'John',
    last_name: 'Doe',
    email: 'john@example.com',
    password: 'Password1!',
  };

  it('createUserSchema rechaza rol OWNER', () => {
    const result = createUserSchema.safeParse({ ...validBase, rol: 'OWNER' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('ADMIN, MANAGER, WAITER, or CHEF');
    }
  });

  it('createUserSchema acepta los roles de gestión', () => {
    for (const rol of ['ADMIN', 'MANAGER', 'WAITER', 'CHEF']) {
      expect(createUserSchema.safeParse({ ...validBase, rol }).success).toBe(true);
    }
  });

  it('updateUserSchema rechaza rol OWNER', () => {
    const result = updateUserSchema.safeParse({ rol: 'OWNER' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('ADMIN, MANAGER, WAITER, or CHEF');
    }
  });

  it('updateUserSchema acepta rol opcional de gestión', () => {
    expect(updateUserSchema.safeParse({ rol: 'MANAGER' }).success).toBe(true);
    expect(updateUserSchema.safeParse({}).success).toBe(true);
  });
});
