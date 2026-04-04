export type SampleTaskStatus = "Pending" | "Complete";

export type SampleProjectTask = {
  id: string;
  name: string;
  assignedTo: string;
  assignedUserId?: string;
  assignedAuthUserId?: string;
  assignedLocation?: string;
  dueDate: string;
  status: SampleTaskStatus;
};

export type SampleQuoteLine = {
  id: string;
  room: string;
  productName: string;
  color: string;
  liftOption: string;
  quantity?: number;
  total: number;
};

export type SamplePayment = {
  id: string;
  date: string;
  amount: number;
  paymentType: string;
  method: string;
  receivedBy: string;
};

export type SampleDocument = {
  id: string;
  name: string;
  uploadedAt: string;
  type: "image" | "pdf";
  preview?: string;
};

export type SampleActivity = {
  id: string;
  timestamp: string;
  userName: string;
  description: string;
};

export type SampleProject = {
  id: string;
  jobNumber: string;
  customerId: string;
  customerName: string;
  address: string;
  projectType: "Standard Install" | "Motorized" | "Repair" | "Commercial";
  workflowTemplateName: string;
  status: "Active" | "On Hold" | "Complete" | "Cancelled";
  location: "Ellsworth" | "Lindsay";
  notes?: string;
  scheduledAt?: string;
  salesRep: {
    name: string;
    initials: string;
  };
  quoteId: string;
  totalAmount: number;
  amountPaid: number;
  gateCode?: string;
  secondaryContact?: {
    name: string;
    phone: string;
    relationship: string;
  };
  customerContact: {
    phone: string;
    email: string;
  };
  assignedTeam: {
    salesRep: string;
    installer: string;
  };
  costing: {
    cogs: number;
    labor: number;
    commission: number;
    grossProfit: number;
  };
  purchaseOrder: {
    manufacturer: string;
    status: string;
    boxes: number;
    expectedDate: string;
  };
  tasks: SampleProjectTask[];
  quoteLines: SampleQuoteLine[];
  payments: SamplePayment[];
  documents: SampleDocument[];
  activity: SampleActivity[];
};

export const sampleProjects: SampleProject[] = [
  {
    id: "sample-project-1",
    jobNumber: normalizeJobNumber("PO2026-1042"),
    customerId: "sample-customer-1",
    customerName: "Carter Residence",
    address: "245 S Main St, Ellsworth, KS 67439",
    projectType: "Motorized",
    workflowTemplateName: "Motorized Install Workflow",
    status: "Active",
    location: "Ellsworth",
    salesRep: { name: "Ava Chen", initials: "AC" },
    quoteId: "quote-sample-1",
    totalAmount: 18640,
    amountPaid: 6200,
    gateCode: "2480#",
    secondaryContact: {
      name: "Jordan Carter",
      phone: "(785) 555-0172",
      relationship: "Spouse",
    },
    customerContact: {
      phone: "(785) 555-0141",
      email: "hello@carterresidence.com",
    },
    assignedTeam: {
      salesRep: "Ava Chen",
      installer: "Marcus Bell",
    },
    costing: {
      cogs: 8110,
      labor: 2100,
      commission: 950,
      grossProfit: 7480,
    },
    purchaseOrder: {
      manufacturer: "Hunter Douglas",
      status: "Awaiting shipment",
      boxes: 6,
      expectedDate: "2026-04-10",
    },
    tasks: [
      { id: "t1", name: "Finalize measurements", assignedTo: "Ava Chen", dueDate: "2026-04-02", status: "Complete" },
      { id: "t2", name: "Submit manufacturer order", assignedTo: "Marcus Bell", dueDate: "2026-04-04", status: "Complete" },
      { id: "t3", name: "Confirm install date", assignedTo: "Ava Chen", dueDate: "2026-04-05", status: "Pending" },
      { id: "t4", name: "Receive inbound shipment", assignedTo: "Marcus Bell", dueDate: "2026-04-10", status: "Pending" },
      { id: "t5", name: "Install and test motors", assignedTo: "Marcus Bell", dueDate: "2026-04-14", status: "Pending" },
      { id: "t6", name: "Collect final payment", assignedTo: "Ava Chen", dueDate: "2026-04-15", status: "Pending" },
    ],
    quoteLines: [
      { id: "ql1", room: "Living Room", productName: "Duette Honeycomb Shade", color: "Linen White", liftOption: "PowerView Gen 3", total: 7280 },
      { id: "ql2", room: "Primary Suite", productName: "Duette Honeycomb Shade", color: "Soft Birch", liftOption: "PowerView Gen 3", total: 11360 },
    ],
    payments: [
      { id: "p1", date: "2026-03-20", amount: 5000, paymentType: "Deposit", method: "ACH", receivedBy: "Ava Chen" },
      { id: "p2", date: "2026-03-28", amount: 1200, paymentType: "Progress", method: "Card", receivedBy: "Ava Chen" },
    ],
    documents: [
      { id: "d1", name: "living-room-measurements.pdf", uploadedAt: "2026-03-19", type: "pdf" },
      { id: "d2", name: "installation-reference.jpg", uploadedAt: "2026-03-30", type: "image" },
    ],
    activity: [
      { id: "a1", timestamp: "2026-04-01T10:15:00Z", userName: "Ava Chen", description: "Updated customer install preferences." },
      { id: "a2", timestamp: "2026-03-28T16:40:00Z", userName: "Marcus Bell", description: "Confirmed order submission with Hunter Douglas." },
      { id: "a3", timestamp: "2026-03-20T09:05:00Z", userName: "Ava Chen", description: "Recorded deposit payment." },
    ],
  },
  {
    id: "sample-project-2",
    jobNumber: normalizeJobNumber("PO2026-1041"),
    customerId: "sample-customer-2",
    customerName: "Lindsay Orthodontics",
    address: "118 N Pine Ave, Lindsay, OK 73052",
    projectType: "Commercial",
    workflowTemplateName: "Commercial Rollout",
    status: "On Hold",
    location: "Lindsay",
    salesRep: { name: "Noah Patel", initials: "NP" },
    quoteId: "quote-sample-2",
    totalAmount: 24120,
    amountPaid: 12060,
    customerContact: {
      phone: "(405) 555-0124",
      email: "office@lindsayortho.com",
    },
    assignedTeam: {
      salesRep: "Noah Patel",
      installer: "Isla Morgan",
    },
    costing: {
      cogs: 10800,
      labor: 2950,
      commission: 1150,
      grossProfit: 9220,
    },
    purchaseOrder: {
      manufacturer: "Alta",
      status: "Delayed by supplier",
      boxes: 8,
      expectedDate: "2026-04-22",
    },
    tasks: [
      { id: "t21", name: "Finalize lobby scope", assignedTo: "Noah Patel", dueDate: "2026-03-26", status: "Complete" },
      { id: "t22", name: "Collect finish approval", assignedTo: "Isla Morgan", dueDate: "2026-03-29", status: "Complete" },
      { id: "t23", name: "Issue PO to supplier", assignedTo: "Noah Patel", dueDate: "2026-04-01", status: "Pending" },
      { id: "t24", name: "Coordinate install crew", assignedTo: "Isla Morgan", dueDate: "2026-04-18", status: "Pending" },
    ],
    quoteLines: [
      { id: "ql21", room: "Reception", productName: "Solar Roller Shade", color: "Graphite", liftOption: "Chainless", total: 11820 },
      { id: "ql22", room: "Consult Rooms", productName: "Blackout Roller Shade", color: "Pearl Gray", liftOption: "Motorized", total: 12300 },
    ],
    payments: [
      { id: "p21", date: "2026-03-24", amount: 12060, paymentType: "Deposit", method: "Check", receivedBy: "Noah Patel" },
    ],
    documents: [
      { id: "d21", name: "commercial-elevations.pdf", uploadedAt: "2026-03-23", type: "pdf" },
    ],
    activity: [
      { id: "a21", timestamp: "2026-04-02T18:10:00Z", userName: "Noah Patel", description: "Placed project on hold pending supplier update." },
      { id: "a22", timestamp: "2026-03-24T11:20:00Z", userName: "Noah Patel", description: "Logged commercial deposit payment." },
    ],
  },
  {
    id: "sample-project-3",
    jobNumber: normalizeJobNumber("PO2026-1039"),
    customerId: "sample-customer-3",
    customerName: "Miller Repair Call",
    address: "487 Oak Crest Dr, Ellsworth, KS 67439",
    projectType: "Repair",
    workflowTemplateName: "Service & Repair",
    status: "Active",
    location: "Ellsworth",
    salesRep: { name: "Leah Brooks", initials: "LB" },
    quoteId: "quote-sample-3",
    totalAmount: 1840,
    amountPaid: 450,
    customerContact: {
      phone: "(785) 555-0108",
      email: "millerfamily@example.com",
    },
    assignedTeam: {
      salesRep: "Leah Brooks",
      installer: "Marcus Bell",
    },
    costing: {
      cogs: 420,
      labor: 280,
      commission: 90,
      grossProfit: 1050,
    },
    purchaseOrder: {
      manufacturer: "Hunter Douglas",
      status: "Parts ordered",
      boxes: 1,
      expectedDate: "2026-04-07",
    },
    tasks: [
      { id: "t31", name: "Confirm failed clutch model", assignedTo: "Leah Brooks", dueDate: "2026-03-31", status: "Complete" },
      { id: "t32", name: "Order replacement parts", assignedTo: "Marcus Bell", dueDate: "2026-04-03", status: "Pending" },
      { id: "t33", name: "Schedule service visit", assignedTo: "Leah Brooks", dueDate: "2026-04-06", status: "Pending" },
    ],
    quoteLines: [
      { id: "ql31", room: "Family Room", productName: "Repair Service", color: "N/A", liftOption: "Replacement clutch", total: 1840 },
    ],
    payments: [
      { id: "p31", date: "2026-03-30", amount: 450, paymentType: "Deposit", method: "Cash", receivedBy: "Leah Brooks" },
    ],
    documents: [
      { id: "d31", name: "damage-photo.jpg", uploadedAt: "2026-03-29", type: "image" },
    ],
    activity: [
      { id: "a31", timestamp: "2026-04-01T08:32:00Z", userName: "Marcus Bell", description: "Reviewed repair photos and parts list." },
    ],
  },
];

export function getSampleProjectById(id: string) {
  return sampleProjects.find((project) => project.id === id) ?? null;
}
import { normalizeJobNumber } from "@/lib/nelo-format";
