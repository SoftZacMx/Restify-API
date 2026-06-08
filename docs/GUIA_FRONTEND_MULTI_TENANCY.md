# Plan de implementación — Signup (registro público) en Restify-Frontend

Integra la pantalla de registro público contra `POST /api/auth/signup`. El backend crea **organización + owner + primera sucursal en una sola request**, setea cookie HttpOnly y devuelve `{ token, user, organization, branch }`. El wizard de 2 pasos es **solo UI**: junta los datos y envía una vez al final.

**Contrato backend (referencia):**
```ts
// POST /api/auth/signup  → 201
// body
{
  user: { email: string; password: string; name: string; lastName: string }; // pass: min8 + min/may/número
  organization: { name: string };
  branch: {
    name: string; state: string; city: string; street: string;
    exteriorNumber: string; phone: string;            // phone min 7
    rfc?: string | null; startOperations?: string | null;
    endOperations?: string | null; timezone?: string; // default 'America/Mexico_City'
  };
}
// data
{
  token: string;
  user: { id; name; last_name; email; rol; organizationId };
  organization: { id; name };
  branch: { id; name };
}
// errores: EMAIL_ALREADY_EXISTS (409), VALIDATION_ERROR (400), TOO_MANY_REQUESTS (429)
```

---

## Paso 1 — Tipos · `src/domain/types/index.ts`

Agregar campos multi-tenant a `User` y los tipos de signup.

```ts
export interface User {
  // ...campos actuales
  rol: UserRole;
  organizationId: string;        // NUEVO
  mustChangePassword: boolean;   // NUEVO
  emailVerified: boolean;        // NUEVO
  createdAt: Date;
  updatedAt: Date;
}

export interface SignupRequest {
  user: { email: string; password: string; name: string; lastName: string };
  organization: { name: string };
  branch: {
    name: string; state: string; city: string; street: string;
    exteriorNumber: string; phone: string;
    rfc?: string | null; startOperations?: string | null;
    endOperations?: string | null; timezone?: string;
  };
}

export interface SignupResponse {
  token: string;
  user: { id: string; name: string; last_name: string; email: string; rol: string; organizationId: string };
  organization: { id: string; name: string };
  branch: { id: string; name: string };
}
```

---

## Paso 2 — Errores · `error-config.ts` + `error-handler.ts`

En `src/domain/errors/error-config.ts`, dentro del objeto `ERROR_CONFIG`:

```ts
EMAIL_ALREADY_EXISTS: {
  message: 'Ya existe una cuenta con este correo',
  statusCode: 409,
  category: 'VALIDATION',
},
TOO_MANY_REQUESTS: {
  message: 'Demasiados intentos. Intenta de nuevo en unos minutos.',
  statusCode: 429,
  category: 'AUTH',
},
```

En `src/shared/utils/error-handler.ts`, dentro de `mapStatusCodeToErrorCode`:

```ts
case 429: return AppError.create('TOO_MANY_REQUESTS', message);
```

---

## Paso 3 — Capa de datos (endpoint público)

**`src/domain/interfaces/auth.interface.ts`** — agregar al `IAuthRepository`:
```ts
signup(data: SignupRequest): Promise<ApiResponse<SignupResponse>>;
```
(importar `SignupRequest`, `SignupResponse` de `../types`)

**`src/infrastructure/api/repositories/auth.repository.ts`** — método nuevo (usa el cliente **público**):
```ts
import { publicApiClient } from '../public-client';
// ...
async signup(data: SignupRequest): Promise<ApiResponse<SignupResponse>> {
  const response = await publicApiClient.post('/api/auth/signup', data);
  return response.data;
}
```

**`src/application/services/auth.service.ts`** — método nuevo (espejo de `login`):
```ts
async signup(data: SignupRequest): Promise<ApiResponse<SignupResponse>> {
  if (!data.user?.email || !data.user?.password) {
    throw AppError.create('MISSING_REQUIRED_FIELD', 'Email y contraseña son requeridos');
  }
  return this.authRepository.signup(data);
}
```

---

## Paso 4 — Hook · `src/presentation/hooks/useAuth.ts`

Agregar acción `signup` análoga a `login` (deja la sesión iniciada y expone loading/error):

```ts
const signup = async (data: SignupRequest) => {
  setIsLoading(true);
  setError(null);
  try {
    const response = await authService.signup(data);
    if (response.success && response.data) {
      loginStore(response.data as unknown as LoginResponse); // token + user → store
      return { success: true };
    }
    const msg = response.error?.message || 'Error al registrarse';
    setError(msg);
    return { success: false, error: msg };
  } catch (err) {
    const appError = err instanceof AppError ? err : AppError.create('UNKNOWN_ERROR', 'Error desconocido');
    setError(appError.message);
    return { success: false, error: appError.message, errorCode: appError.code };
  } finally {
    setIsLoading(false);
  }
};
// ...exponer `signup` en el return del hook
```

---

## Paso 5 — Password requirements · `src/presentation/components/ui/password-requirements.tsx`

El password de signup **no** exige carácter especial. Parametrizar el componente:

```ts
interface PasswordRequirementsProps {
  password: string;
  requireSpecialChar?: boolean; // default true (no rompe recover-password)
}

export function PasswordRequirements({ password, requireSpecialChar = true }: PasswordRequirementsProps) {
  if (!password) return null;
  const requirements = requireSpecialChar
    ? REQUIREMENTS
    : REQUIREMENTS.filter((r) => r.label !== 'Un carácter especial');
  // ...render sobre `requirements`
}
```

---

## Paso 6 — Schema · `src/presentation/pages/auth/signup.schema.ts` (NUEVO)

```ts
import { z } from 'zod';

export const signupOwnerSchema = z.object({
  name: z.string().min(2, 'Mínimo 2 caracteres'),
  lastName: z.string().min(2, 'Mínimo 2 caracteres'),
  email: z.string().email('Email inválido'),
  organizationName: z.string().min(2, 'Mínimo 2 caracteres'),
  password: z.string()
    .min(8, 'Mínimo 8 caracteres')
    .regex(/[a-z]/, 'Debe incluir una minúscula')
    .regex(/[A-Z]/, 'Debe incluir una mayúscula')
    .regex(/\d/, 'Debe incluir un número'),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword'],
});

export const signupBranchSchema = z.object({
  name: z.string().min(2, 'Mínimo 2 caracteres'),
  state: z.string().min(1, 'Requerido'),
  city: z.string().min(1, 'Requerido'),
  street: z.string().min(1, 'Requerido'),
  exteriorNumber: z.string().min(1, 'Requerido'),
  phone: z.string().min(7, 'Teléfono inválido'),
  rfc: z.string().optional(),
});

export type SignupOwnerFormData = z.infer<typeof signupOwnerSchema>;
export type SignupBranchFormData = z.infer<typeof signupBranchSchema>;
```

---

## Paso 7 — Pantalla · `src/presentation/pages/auth/SignupPage.tsx` (NUEVO)

Wizard de 2 pasos, misma estructura que `RecoverPasswordPage.tsx`.

- `useState<'owner' | 'branch'>('owner')`; dos `useForm` (uno por schema).
- Estado local: `isLoading`, `error`, datos del paso 1 guardados al avanzar.
- **Paso 1 (owner):** valida con `signupOwnerSchema`, guarda los datos y hace `setStep('branch')`. **No llama al backend.** Usa `<PasswordRequirements requireSpecialChar={false} />`.
- **Paso 2 (branch):** valida con `signupBranchSchema` y arma el payload, luego `signup(...)`:

```ts
const onSubmitBranch = async (branch: SignupBranchFormData) => {
  const payload: SignupRequest = {
    user: {
      email: ownerData.email, password: ownerData.password,
      name: ownerData.name, lastName: ownerData.lastName,
    },
    organization: { name: ownerData.organizationName },
    branch: {
      ...branch,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, // autodetectado, no es campo del form
    },
  };
  const result = await signup(payload);
  if (result.success) navigate('/dashboard');
};
```

- Reusar UI de `RecoverPasswordPage`: logo, `Card`, toggles de password (`Eye`/`EyeOff`), bloque de error, botón con estado `isLoading`, botón "Atrás" en el paso 2 y link "Volver al inicio de sesión".

---

## Paso 8 — Routing y enlace

**`src/App.tsx`** — import estático (como `LoginPage`) + ruta:
```tsx
import SignupPage from '@/presentation/pages/auth/SignupPage';
// ...junto a las rutas de auth:
<Route path="/auth/signup" element={<SignupPage />} />
```

**`src/presentation/pages/auth/LoginPage.tsx`** — link bajo el de "¿Olvidaste tu contraseña?":
```tsx
<Link to="/auth/signup" className="text-sm text-blue-500 hover:underline font-medium">
  ¿No tienes cuenta? Regístrate
</Link>
```

---

## Verificación

1. `cd Restify-Frontend && npm run build` (corre `tsc -b` + vite) y `npm run lint`.
2. Backend en `localhost:3000` + `npm run dev`. Ir a `/auth/signup`:
   - Email nuevo → completa wizard → queda logueado y redirige a `/dashboard`.
   - Mismo email otra vez → muestra "Ya existe una cuenta con este correo" (409).
   - Reglas de password en vivo, sin requisito de carácter especial.
