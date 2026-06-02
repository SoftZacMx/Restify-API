export class UserBranchAccess {
  constructor(
    public readonly userId: string,
    public readonly branchId: string,
    public readonly createdAt: Date
  ) {}
}
