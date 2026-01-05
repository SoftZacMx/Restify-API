# Checklist de Migración por Módulo

## 📋 Checklist General

### Para cada módulo a migrar:

- [ ] **Análisis**
  - [ ] Revisar código actual del módulo
  - [ ] Identificar lógica de negocio
  - [ ] Identificar queries SQL
  - [ ] Identificar dependencias externas
  - [ ] Documentar casos de uso

- [ ] **Domain Layer**
  - [ ] Crear entidad de dominio
  - [ ] Definir value objects necesarios
  - [ ] Crear interfaces de repositorio
  - [ ] Definir eventos de dominio (si aplica)

- [ ] **Repository**
  - [ ] Implementar repositorio con Prisma
  - [ ] Migrar queries SQL a Prisma
  - [ ] Escribir tests del repositorio
  - [ ] Verificar performance

- [ ] **Use Cases**
  - [ ] Extraer lógica de negocio a use cases
  - [ ] Un use case por operación
  - [ ] Inyección de dependencias
  - [ ] Escribir tests unitarios

- [ ] **DTOs y Validaciones**
  - [ ] Crear DTOs de request
  - [ ] Crear DTOs de response
  - [ ] Crear schemas Zod
  - [ ] Validar todos los campos

- [ ] **Lambda Handler**
  - [ ] Crear handler Lambda
  - [ ] Integrar validación Zod
  - [ ] Llamar a use case
  - [ ] Manejo de errores
  - [ ] Respuesta estandarizada

- [ ] **API Gateway**
  - [ ] Configurar ruta en serverless.yml
  - [ ] Configurar middlewares (auth, validation)
  - [ ] Configurar CORS si es necesario
  - [ ] Configurar rate limiting

- [ ] **Testing**
  - [ ] Unit tests (use cases)
  - [ ] Integration tests (handlers)
  - [ ] E2E tests (flujos completos)
  - [ ] Verificar cobertura > 80%

- [ ] **Documentación**
  - [ ] Actualizar API docs
  - [ ] Documentar cambios
  - [ ] Ejemplos de uso

- [ ] **Deployment**
  - [ ] Deploy a staging
  - [ ] Testing en staging
  - [ ] Deploy a producción
  - [ ] Monitoreo post-deployment

---

## 📦 Módulos a Migrar

### ✅ Completados
- [ ] (Ninguno aún)

### 🚧 En Progreso
- [ ] (Ninguno aún)

### 📋 Pendientes

#### 1. Auth Module
- [ ] Login
- [ ] Verify User
- [ ] Set Password
- [ ] JWT Authorization

#### 2. Products Module
- [ ] Create Product
- [ ] Get Products
- [ ] Update Product
- [ ] Delete Product
- [ ] Filters y paginación

#### 3. Orders Module
- [ ] Create Order
- [ ] Get Order
- [ ] Update Order Status
- [ ] Pay Order (integración con pagos)
- [ ] Order Items

#### 4. Payments Module
- [ ] Initiate Payment
- [ ] Confirm Payment
- [ ] Get Payment Status
- [ ] Refund Payment
- [ ] Webhook Handler
- [ ] Payment Sessions

#### 5. Users Module
- [ ] Create User
- [ ] Get Users
- [ ] Update User
- [ ] Delete User
- [ ] User Roles

#### 6. Cash Flow Reports Module ⚠️ **NUEVO - Reemplaza Cash Register**
- [ ] Get Cash Flow Report (por fecha/rango)
- [ ] Get Cash Flow Report by User (por mesero)
- [ ] Get Cash Flow Summary
- [ ] Agrupación por método de pago
- [ ] Incluir tips y pagos divididos
- [ ] Exportar reporte (opcional)

#### 7. Tables Module
- [ ] Create Table
- [ ] Get Tables
- [ ] Update Table Status
- [ ] Delete Table

#### 8. Business Services Module
- [ ] Create Service
- [ ] Get Services
- [ ] Update Service
- [ ] Delete Service
- [ ] Service Payments

#### 9. Employees Salaries Module
- [ ] Create Salary Payment
- [ ] Get Salary Payments
- [ ] Update Salary Payment
- [ ] Delete Salary Payment

#### 10. Reports Module
- [ ] Sales Reports
- [ ] Financial Reports
- [ ] Order Reports
- [ ] Cash Flow Reports

---

## 🔍 Verificación Post-Migración

Para cada módulo migrado, verificar:

- [ ] Todos los endpoints funcionan correctamente
- [ ] Validaciones funcionando
- [ ] Autenticación/autorización funcionando
- [ ] Manejo de errores correcto
- [ ] Logs estructurados
- [ ] Performance aceptable
- [ ] Tests pasando
- [ ] Documentación actualizada
- [ ] Sin regresiones en funcionalidad existente

---

## 📊 Progreso General

**Módulos Completados:** 0/10 (0%)  
**Endpoints Migrados:** 0/XX (0%)  
**Tests Escritos:** 0  
**Cobertura de Tests:** 0%

---

## ⚠️ Nota Importante: Cambio Arquitectónico

**Módulo Cash Register Eliminado:**
- El módulo `cash_register` ha sido eliminado del plan de migración
- Reemplazado por **Cash Flow Reports** (módulo 6)
- Ver sección "Decisiones Arquitectónicas" en PLAN_DE_DESARROLLO.md para más detalles

---

**Última actualización:** [Fecha]

