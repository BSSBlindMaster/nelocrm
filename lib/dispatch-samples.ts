export type DispatchJob = {
  job_id: string;
  project_id?: string | null;
  customer_id?: string | null;
  customer_name: string;
  phone: string;
  address: string;
  gate_code?: string | null;
  scheduled_at: string;
  duration_minutes: number;
  assigned_to?: string | null;
  assigned_to_name: string;
  assigned_to_phone?: string | null;
  status: "scheduled" | "in_progress" | "complete" | "issue";
  job_type: "Install" | "Repair" | "Measure" | "Service";
  lat: number;
  lng: number;
  notes?: string;
  products: Array<{
    id: string;
    name: string;
    color: string;
    lift_option: string;
    quantity: number;
  }>;
};

function todayAt(hours: number, minutes = 0) {
  const base = new Date();
  base.setHours(hours, minutes, 0, 0);
  return base.toISOString();
}

export function getSampleDispatchJobs(): DispatchJob[] {
  return [
    {
      job_id: "dispatch-sample-1",
      customer_name: "Carter Residence",
      phone: "(480) 555-0121",
      address: "2150 E Brown Rd, Mesa, AZ 85213",
      gate_code: "2480#",
      scheduled_at: todayAt(8, 0),
      duration_minutes: 90,
      assigned_to: "installer-sample-1",
      assigned_to_name: "Marcus Bell",
      assigned_to_phone: "(480) 555-0147",
      status: "scheduled",
      job_type: "Install",
      lat: 33.4367,
      lng: -111.7857,
      notes: "Front entry install",
      products: [
        { id: "p1", name: "Duette Honeycomb Shade", color: "Moon White", lift_option: "PowerView", quantity: 2 },
      ],
    },
    {
      job_id: "dispatch-sample-2",
      customer_name: "Lindsay Orthodontics",
      phone: "(480) 555-0188",
      address: "1830 S Val Vista Dr, Mesa, AZ 85204",
      scheduled_at: todayAt(9, 30),
      duration_minutes: 60,
      assigned_to: "installer-sample-2",
      assigned_to_name: "Isla Morgan",
      assigned_to_phone: "(480) 555-0150",
      status: "in_progress",
      job_type: "Repair",
      lat: 33.3812,
      lng: -111.7565,
      notes: "Clutch replacement",
      products: [
        { id: "p2", name: "Roller Shade Repair", color: "Graphite", lift_option: "Chainless", quantity: 1 },
      ],
    },
    {
      job_id: "dispatch-sample-3",
      customer_name: "Mesa Lakeside Condo",
      phone: "(480) 555-0167",
      address: "3440 E Baseline Rd, Mesa, AZ 85204",
      scheduled_at: todayAt(11, 0),
      duration_minutes: 90,
      assigned_to: "installer-sample-1",
      assigned_to_name: "Marcus Bell",
      assigned_to_phone: "(480) 555-0147",
      status: "scheduled",
      job_type: "Measure",
      lat: 33.3788,
      lng: -111.7579,
      notes: "Measure for new shutters",
      products: [
        { id: "p3", name: "Plantation Shutters", color: "Soft Cotton", lift_option: "Standard", quantity: 5 },
      ],
    },
    {
      job_id: "dispatch-sample-4",
      customer_name: "Desert Ridge Service Call",
      phone: "(480) 555-0103",
      address: "6555 E Southern Ave, Mesa, AZ 85206",
      scheduled_at: todayAt(13, 0),
      duration_minutes: 90,
      assigned_to: null,
      assigned_to_name: "Unassigned",
      status: "scheduled",
      job_type: "Service",
      lat: 33.3939,
      lng: -111.689,
      notes: "Unassigned service call",
      products: [
        { id: "p4", name: "Service Visit", color: "Existing product", lift_option: "N/A", quantity: 1 },
      ],
    },
    {
      job_id: "dispatch-sample-5",
      customer_name: "Broadway Remodel",
      phone: "(480) 555-0132",
      address: "9233 E Broadway Rd, Mesa, AZ 85208",
      scheduled_at: todayAt(15, 0),
      duration_minutes: 120,
      assigned_to: "installer-sample-2",
      assigned_to_name: "Isla Morgan",
      assigned_to_phone: "(480) 555-0150",
      status: "complete",
      job_type: "Install",
      lat: 33.4057,
      lng: -111.6324,
      notes: "Completed motorized install",
      products: [
        { id: "p5", name: "Motorized Roman Shade", color: "Sandstone", lift_option: "PowerView", quantity: 3 },
      ],
    },
  ];
}
