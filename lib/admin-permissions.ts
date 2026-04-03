export type PermissionDefinition = {
  key: string;
  label: string;
  description: string;
  category:
    | "Customers"
    | "Quotes & Orders"
    | "Scheduling"
    | "Reporting"
    | "Install Team"
    | "Admin";
};

export const permissionDefinitions: PermissionDefinition[] = [
  {
    key: "customers.view",
    label: "View customers",
    description: "Open customer profiles and customer activity.",
    category: "Customers",
  },
  {
    key: "customers.edit",
    label: "Edit customers",
    description: "Create and update customer records.",
    category: "Customers",
  },
  {
    key: "quotes.view",
    label: "View quotes",
    description: "Access the quotes pipeline and quote details.",
    category: "Quotes & Orders",
  },
  {
    key: "quotes.edit",
    label: "Edit quotes",
    description: "Create quotes and update quote pricing.",
    category: "Quotes & Orders",
  },
  {
    key: "orders.manage",
    label: "Manage orders",
    description: "Create orders and update order statuses.",
    category: "Quotes & Orders",
  },
  {
    key: "scheduling.view",
    label: "View schedule",
    description: "See calendar, dispatch, and appointments.",
    category: "Scheduling",
  },
  {
    key: "scheduling.manage",
    label: "Manage schedule",
    description: "Assign jobs, crews, and dispatch details.",
    category: "Scheduling",
  },
  {
    key: "reporting.view",
    label: "View reporting",
    description: "Access performance, sales, and operations reporting.",
    category: "Reporting",
  },
  {
    key: "install.view",
    label: "View install team",
    description: "See installer assignments and workload.",
    category: "Install Team",
  },
  {
    key: "install.manage",
    label: "Manage install team",
    description: "Update install assignments and statuses.",
    category: "Install Team",
  },
  {
    key: "admin.users",
    label: "Manage users",
    description: "Create, edit, and deactivate app users.",
    category: "Admin",
  },
  {
    key: "admin.roles",
    label: "Manage roles",
    description: "Create roles and change permission defaults.",
    category: "Admin",
  },
];

export const permissionCategories: PermissionDefinition["category"][] = [
  "Customers",
  "Quotes & Orders",
  "Scheduling",
  "Reporting",
  "Install Team",
  "Admin",
];

export function groupPermissionsByCategory() {
  return permissionCategories.map((category) => ({
    category,
    permissions: permissionDefinitions.filter(
      (permission) => permission.category === category,
    ),
  }));
}
