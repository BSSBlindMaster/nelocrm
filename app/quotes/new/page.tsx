"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
import { FRACTION_OPTIONS, fractionToNumber, formatMeasurement, type FractionValue } from "@/lib/nelo-format";
import { supabase } from "@/lib/supabase";

type Customer = {
  id: string;
  name: string;
  first_name?: string | null;
  last_name?: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
};

type Manufacturer = {
  id: string;
  name: string;
};

type Product = {
  id: string;
  manufacturer_id: string;
  name: string;
};

type Fabric = {
  id: string;
  product_id: string;
  name: string;
  fabric_code: string;
};

type LiftOption = {
  id: string;
  product_id: string;
  name: string;
  surcharge_value: number | null;
};

type BusinessSettings = {
  default_shipping: number | null;
  default_installation: number | null;
  tax_rate: number | null;
  terms_and_conditions?: string | null;
};

type PricingSettings = {
  manufacturer_id: string;
  default_margin: number;
  minimum_margin: number;
  cost_factor: number;
};

type QuoteFormState = {
  room: string;
  manufacturerId: string;
  productId: string;
  fabricId: string;
  liftOptionId: string;
  mountType: "Inside mount" | "Outside mount" | "";
  widthWhole: string;
  widthFraction: FractionValue;
  heightWhole: string;
  heightFraction: FractionValue;
  quantity: string;
  notes: string;
};

type LineItem = {
  id: string;
  room: string;
  manufacturerId: string;
  manufacturerName: string;
  productId: string;
  productName: string;
  fabricId: string;
  fabricName: string;
  fabricCode: string;
  liftOptionId: string;
  liftOptionName: string;
  mountType: "Inside mount" | "Outside mount";
  widthWhole: number;
  widthFraction: FractionValue;
  heightWhole: number;
  heightFraction: FractionValue;
  quantity: number;
  notes: string;
  msrpBase: number;
  surchargeTotal: number;
  msrpTotal: number;
  costFactor: number;
  costPrice: number;
  sellPrice: number;
  lineTotal: number;
};

type PriceResult = {
  msrp_base: number | null;
  surcharges_total: number | null;
  msrp_total: number | null;
  cost_price: number | null;
  sell_price: number | null;
};

const emptyForm: QuoteFormState = {
  room: "",
  manufacturerId: "",
  productId: "",
  fabricId: "",
  liftOptionId: "",
  mountType: "",
  widthWhole: "",
  widthFraction: "0",
  heightWhole: "",
  heightFraction: "0",
  quantity: "1",
  notes: "",
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function toDimension(whole: string, fraction: FractionValue) {
  const wholeNumber = Number(whole || 0);
  return wholeNumber + fractionToNumber(fraction);
}

function buildQuoteNumber() {
  const now = new Date();
  const datePart = [
    String(now.getFullYear()).slice(-2),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("");
  const randomPart = String(Math.floor(1000 + Math.random() * 9000));
  return `NEL${datePart}${randomPart}`;
}

function formatAddress(customer: Customer) {
  return [customer.address, customer.city, customer.state, customer.zip]
    .filter(Boolean)
    .join(", ");
}

function getCustomerDisplayName(customer: Customer) {
  return (
    customer.name ||
    [customer.first_name, customer.last_name].filter(Boolean).join(" ") ||
    "Customer"
  );
}

function StepLabel({ step, label }: { step: number; label: string }) {
  return (
    <div className="mb-2 flex items-center gap-3">
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-stone-100 text-xs font-semibold text-stone-500">
        {step}
      </span>
      <label className="text-sm font-medium text-stone-700">{label}</label>
    </div>
  );
}

export default function NewQuotePage() {
  const router = useRouter();
  const [quoteNumber] = useState(buildQuoteNumber);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [fabrics, setFabrics] = useState<Fabric[]>([]);
  const [liftOptions, setLiftOptions] = useState<LiftOption[]>([]);
  const [businessSettings, setBusinessSettings] = useState<BusinessSettings | null>(null);
  const [pricingSettings, setPricingSettings] = useState<PricingSettings[]>([]);
  const [customerQuery, setCustomerQuery] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [form, setForm] = useState<QuoteFormState>(emptyForm);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [shipping, setShipping] = useState("0");
  const [installation, setInstallation] = useState("0");
  const [discountType, setDiscountType] = useState<"percent" | "amount">("percent");
  const [discountValue, setDiscountValue] = useState("0");
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [priceResult, setPriceResult] = useState<PriceResult | null>(null);
  const [pricingError, setPricingError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [savedQuoteId, setSavedQuoteId] = useState<string | null>(null);
  const [agreementName, setAgreementName] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [agreedToDisclaimer, setAgreedToDisclaimer] = useState(false);
  const [signatureError, setSignatureError] = useState("");
  const [signatureSuccess, setSignatureSuccess] = useState("");
  const [isSavingSignature, setIsSavingSignature] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      setIsLoadingData(true);

      const [
        customersResponse,
        manufacturersResponse,
        productsResponse,
        fabricsResponse,
        liftOptionsResponse,
        businessSettingsResponse,
        pricingSettingsResponse,
      ] = await Promise.all([
        supabase
          .from("customers")
          .select("id, name, first_name, last_name, phone, address, city, state, zip")
          .order("name"),
        supabase.from("manufacturers").select("id, name").eq("active", true).order("name"),
        supabase.from("products").select("id, manufacturer_id, name").eq("active", true).order("name"),
        supabase
          .from("fabrics")
          .select("id, product_id, name, fabric_code")
          .order("name"),
        supabase
          .from("lift_options")
          .select("id, product_id, name, surcharge_value")
          .order("name"),
        supabase
          .from("business_settings")
          .select("default_shipping, default_installation, tax_rate, terms_and_conditions")
          .limit(1)
          .maybeSingle(),
        supabase
          .from("pricing_settings")
          .select("manufacturer_id, default_margin, minimum_margin, cost_factor"),
      ]);

      if (!isMounted) {
        return;
      }

      setCustomers((customersResponse.data as Customer[] | null) ?? []);
      setManufacturers((manufacturersResponse.data as Manufacturer[] | null) ?? []);
      setProducts((productsResponse.data as Product[] | null) ?? []);
      setFabrics((fabricsResponse.data as Fabric[] | null) ?? []);
      setLiftOptions((liftOptionsResponse.data as LiftOption[] | null) ?? []);
      setBusinessSettings((businessSettingsResponse.data as BusinessSettings | null) ?? null);
      setPricingSettings((pricingSettingsResponse.data as PricingSettings[] | null) ?? []);

      setShipping(String(businessSettingsResponse.data?.default_shipping ?? 300));
      setInstallation(String(businessSettingsResponse.data?.default_installation ?? 0));
      setIsLoadingData(false);
    }

    void loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  const matchingCustomers = useMemo(() => {
    const term = customerQuery.trim().toLowerCase();

    if (!term) {
      return customers.slice(0, 8);
    }

    return customers
      .filter((customer) => {
        return (
          customer.name.toLowerCase().includes(term) ||
          (customer.phone ?? "").toLowerCase().includes(term)
        );
      })
      .slice(0, 8);
  }, [customerQuery, customers]);

  const availableProducts = useMemo(() => {
    if (!form.manufacturerId) {
      return [];
    }

    return products.filter((product) => product.manufacturer_id === form.manufacturerId);
  }, [form.manufacturerId, products]);

  const availableFabrics = useMemo(() => {
    if (!form.productId) {
      return [];
    }

    return fabrics.filter((fabric) => fabric.product_id === form.productId);
  }, [form.productId, fabrics]);

  const availableLiftOptions = useMemo(() => {
    if (!form.productId) {
      return [];
    }

    return liftOptions.filter((liftOption) => liftOption.product_id === form.productId);
  }, [form.productId, liftOptions]);

  const selectedManufacturer = manufacturers.find(
    (manufacturer) => manufacturer.id === form.manufacturerId,
  );
  const selectedProduct = products.find((product) => product.id === form.productId);
  const selectedFabric = fabrics.find((fabric) => fabric.id === form.fabricId);
  const selectedLiftOption = liftOptions.find(
    (liftOption) => liftOption.id === form.liftOptionId,
  );
  const selectedPricingSettings = pricingSettings.find(
    (pricing) => pricing.manufacturer_id === form.manufacturerId,
  );

  useEffect(() => {
    setAgreementName(selectedCustomer ? getCustomerDisplayName(selectedCustomer) : "");
  }, [selectedCustomer]);

  useEffect(() => {
    if (!selectedFabric || !form.widthWhole || !form.heightWhole || !selectedPricingSettings) {
      setPriceResult(null);
      setPricingError("");
      return;
    }

    let isMounted = true;
    const fabric = selectedFabric;
    const pricing = selectedPricingSettings;
    const liftSurcharge = selectedLiftOption?.surcharge_value ?? 0;

    async function calculatePrice() {
      const { data, error } = await supabase.rpc("calculate_line_price", {
        p_fabric_code: fabric.fabric_code,
        p_width_inches: toDimension(form.widthWhole, form.widthFraction),
        p_height_inches: toDimension(form.heightWhole, form.heightFraction),
        p_lift_surcharge: liftSurcharge,
        p_design_surcharge: 0,
        p_cost_factor: pricing.cost_factor,
        p_margin: pricing.default_margin,
      });

      if (!isMounted) {
        return;
      }

      if (error) {
        setPriceResult(null);
        setPricingError("Unable to calculate price for this size.");
        return;
      }

      const nextPrice = Array.isArray(data) ? (data[0] as PriceResult | undefined) : undefined;
      setPriceResult(nextPrice ?? null);
      setPricingError("");
    }

    void calculatePrice();

    return () => {
      isMounted = false;
    };
  }, [
    form.heightFraction,
    form.heightWhole,
    form.widthFraction,
    form.widthWhole,
    selectedFabric,
    selectedLiftOption,
    selectedPricingSettings,
  ]);

  const subtotal = useMemo(() => {
    return lineItems.reduce((sum, line) => sum + line.lineTotal, 0);
  }, [lineItems]);

  const discountAmount = useMemo(() => {
    const rawDiscount = Number(discountValue || 0);

    if (discountType === "percent") {
      return subtotal * (rawDiscount / 100);
    }

    return rawDiscount;
  }, [discountType, discountValue, subtotal]);

  const taxRate = businessSettings?.tax_rate ?? 0.0875;
  const taxableAmount = Math.max(
    subtotal + Number(shipping || 0) + Number(installation || 0) - discountAmount,
    0,
  );
  const taxAmount = taxableAmount * taxRate;
  const total = taxableAmount + taxAmount;

  function updateForm<Key extends keyof QuoteFormState>(
    key: Key,
    value: QuoteFormState[Key],
  ) {
    setForm((current) => {
      if (key === "manufacturerId") {
        return {
          ...current,
          manufacturerId: value,
          productId: "",
          fabricId: "",
          liftOptionId: "",
        };
      }

      if (key === "productId") {
        return {
          ...current,
          productId: value,
          fabricId: "",
          liftOptionId: "",
        };
      }

      return {
        ...current,
        [key]: value,
      };
    });
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingLineId(null);
    setPriceResult(null);
    setPricingError("");
  }

  function startDrawing(clientX: number, clientY: number) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const context = canvas.getContext("2d");
    if (!context) return;
    drawingRef.current = true;
    context.lineWidth = 2.5;
    context.lineCap = "round";
    context.strokeStyle = "#1C1C1C";
    context.beginPath();
    context.moveTo(clientX - rect.left, clientY - rect.top);
  }

  function continueDrawing(clientX: number, clientY: number) {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const rect = canvas.getBoundingClientRect();
    context.lineTo(clientX - rect.left, clientY - rect.top);
    context.stroke();
  }

  function stopDrawing() {
    drawingRef.current = false;
  }

  function clearSignature() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    setSignatureError("");
    setSignatureSuccess("");
  }

  function signatureIsEmpty() {
    const canvas = canvasRef.current;
    if (!canvas) return true;
    const context = canvas.getContext("2d");
    if (!context) return true;
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    for (let index = 3; index < pixels.length; index += 4) {
      if (pixels[index] !== 0) {
        return false;
      }
    }
    return true;
  }

  function handleEdit(line: LineItem) {
    setEditingLineId(line.id);
    setForm({
      room: line.room,
      manufacturerId: line.manufacturerId,
      productId: line.productId,
      fabricId: line.fabricId,
      liftOptionId: line.liftOptionId,
      mountType: line.mountType,
      widthWhole: String(line.widthWhole),
      widthFraction: line.widthFraction,
      heightWhole: String(line.heightWhole),
      heightFraction: line.heightFraction,
      quantity: String(line.quantity),
      notes: line.notes,
    });
  }

  function handleDelete(id: string) {
    setLineItems((current) => current.filter((line) => line.id !== id));
    if (editingLineId === id) {
      resetForm();
    }
  }

  function handleAddLine() {
    if (
      !form.room ||
      !selectedManufacturer ||
      !selectedProduct ||
      !selectedFabric ||
      !selectedLiftOption ||
      !form.mountType ||
      !form.widthWhole ||
      !form.heightWhole ||
      !priceResult ||
      !selectedPricingSettings
    ) {
      return;
    }

    const quantity = Math.max(Number(form.quantity || 1), 1);
    const unitPrice = priceResult.sell_price ?? 0;

    const nextLine: LineItem = {
      id: editingLineId ?? crypto.randomUUID(),
      room: form.room,
      manufacturerId: selectedManufacturer.id,
      manufacturerName: selectedManufacturer.name,
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      fabricId: selectedFabric.id,
      fabricName: selectedFabric.name,
      fabricCode: selectedFabric.fabric_code,
      liftOptionId: selectedLiftOption.id,
      liftOptionName: selectedLiftOption.name,
      mountType: form.mountType,
      widthWhole: Number(form.widthWhole),
      widthFraction: form.widthFraction,
      heightWhole: Number(form.heightWhole),
      heightFraction: form.heightFraction,
      quantity,
      notes: form.notes,
      msrpBase: priceResult.msrp_base ?? 0,
      surchargeTotal: priceResult.surcharges_total ?? 0,
      msrpTotal: priceResult.msrp_total ?? 0,
      costFactor: selectedPricingSettings.cost_factor,
      costPrice: priceResult.cost_price ?? 0,
      sellPrice: unitPrice,
      lineTotal: unitPrice * quantity,
    };

    setLineItems((current) => {
      if (editingLineId) {
        return current.map((line) => (line.id === editingLineId ? nextLine : line));
      }

      return [...current, nextLine];
    });

    resetForm();
  }

  async function persistQuote(nextStatus: "pending" | "ordered" | "approved") {
    if (!selectedCustomer || lineItems.length === 0) {
      setSaveError("Select a customer and add at least one line before saving.");
      return null;
    }

    setIsSaving(true);
    setSaveError("");

    if (savedQuoteId) {
      const { error: updateError } = await supabase
        .from("quotes")
        .update({
          customer_id: selectedCustomer.id,
          status: nextStatus,
          subtotal,
          shipping: Number(shipping || 0),
          installation: Number(installation || 0),
          discount_type: discountType,
          discount_value: Number(discountValue || 0),
          tax_rate: taxRate,
          tax_amount: taxAmount,
          total,
          notes: `Quote ${quoteNumber}`,
        })
        .eq("id", savedQuoteId);

      if (updateError) {
        setSaveError("Unable to update quote right now.");
        setIsSaving(false);
        return null;
      }

      await supabase.from("quote_lines").delete().eq("quote_id", savedQuoteId);
      const refreshedLines = lineItems.map((line, index) => ({
        quote_id: savedQuoteId,
        line_number: index + 1,
        room: line.room,
        manufacturer_id: line.manufacturerId,
        product_id: line.productId,
        fabric_id: line.fabricId,
        lift_option_id: line.liftOptionId,
        design_options: null,
        mount_type: line.mountType,
        width_whole: line.widthWhole,
        width_fraction: line.widthFraction,
        height_whole: line.heightWhole,
        height_fraction: line.heightFraction,
        quantity: line.quantity,
        msrp_base: line.msrpBase,
        surcharges_total: line.surchargeTotal,
        msrp_total: line.msrpTotal,
        cost_factor: line.costFactor,
        cost_price: line.costPrice,
        sell_price: line.sellPrice,
        line_total: line.lineTotal,
        notes: line.notes || null,
      }));
      await supabase.from("quote_lines").insert(refreshedLines);

      setIsSaving(false);
      return savedQuoteId;
    }

    const quoteNotes = `Quote ${quoteNumber}`;
    const { data: quote, error: quoteError } = await supabase
      .from("quotes")
      .insert({
        customer_id: selectedCustomer.id,
        status: nextStatus,
        subtotal,
        shipping: Number(shipping || 0),
        installation: Number(installation || 0),
        discount_type: discountType,
        discount_value: Number(discountValue || 0),
        tax_rate: taxRate,
        tax_amount: taxAmount,
        total,
        notes: quoteNotes,
      })
      .select("id")
      .single();

    if (quoteError || !quote) {
      setSaveError("Unable to save quote right now.");
      setIsSaving(false);
      return null;
    }

    const linePayload = lineItems.map((line, index) => ({
      quote_id: quote.id,
      line_number: index + 1,
      room: line.room,
      manufacturer_id: line.manufacturerId,
      product_id: line.productId,
      fabric_id: line.fabricId,
      lift_option_id: line.liftOptionId,
      design_options: null,
      mount_type: line.mountType,
      width_whole: line.widthWhole,
      width_fraction: line.widthFraction,
      height_whole: line.heightWhole,
      height_fraction: line.heightFraction,
      quantity: line.quantity,
      msrp_base: line.msrpBase,
      surcharges_total: line.surchargeTotal,
      msrp_total: line.msrpTotal,
      cost_factor: line.costFactor,
      cost_price: line.costPrice,
      sell_price: line.sellPrice,
      line_total: line.lineTotal,
      notes: line.notes || null,
    }));

    const { error: lineError } = await supabase.from("quote_lines").insert(linePayload);

    if (lineError) {
      setSaveError("Quote saved, but line items could not be written.");
      setIsSaving(false);
      return null;
    }

    setSavedQuoteId(String(quote.id));
    setIsSaving(false);
    return String(quote.id);
  }

  async function saveAndRedirect(nextStatus: "pending" | "ordered") {
    const quoteId = await persistQuote(nextStatus);
    if (quoteId) {
      router.push("/quotes");
    }
  }

  async function handleSaveSignature() {
    if (!lineItems.length) {
      setSignatureError("Add at least one line before requesting signature.");
      return;
    }

    if (!agreedToTerms || !agreedToDisclaimer) {
      setSignatureError("The customer must agree to both confirmations before signing.");
      return;
    }

    if (!agreementName.trim()) {
      setSignatureError("Enter the customer's name before saving the signature.");
      return;
    }

    if (signatureIsEmpty()) {
      setSignatureError("Capture a signature before saving.");
      return;
    }

    setIsSavingSignature(true);
    setSignatureError("");
    setSignatureSuccess("");

    const quoteId = await persistQuote("approved");
    if (!quoteId) {
      setIsSavingSignature(false);
      return;
    }

    const signatureData = canvasRef.current?.toDataURL("image/png") ?? "";

    const { error } = await supabase.from("quote_signatures").insert({
      quote_id: quoteId,
      customer_name: agreementName.trim(),
      signature_data: signatureData,
      agreed_to_terms: true,
      agreed_to_disclaimer: true,
      ip_address: null,
      signed_at: new Date().toISOString(),
    });

    if (error) {
      setSignatureError("Quote saved, but the signature could not be recorded.");
      setIsSavingSignature(false);
      return;
    }

    setSignatureSuccess(`Quote approved and signed by ${agreementName.trim()}`);
    setIsSavingSignature(false);
  }

  return (
    <main className="flex min-h-screen bg-stone-100">
      <Sidebar current="Quotes" />

      <section className="flex min-h-screen flex-1 flex-col">
        <Topbar
          title="New quote"
          titlePrefix={
            <Link
              href="/quotes"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-stone-200 text-stone-500 transition hover:border-stone-300 hover:text-stone-700"
              aria-label="Back to quotes"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <path d="M12.5 4.5 7 10l5.5 5.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          }
        />

        <div className="flex-1 space-y-6 p-8">
          <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="w-full max-w-xl">
                <StepLabel step={1} label="Customer selector" />
                <input
                  type="search"
                  value={customerQuery}
                  onChange={(event) => setCustomerQuery(event.target.value)}
                  placeholder="Search customers by name or phone..."
                  className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700 outline-none transition placeholder:text-stone-400 focus:border-primary focus:ring-2 focus:ring-primary/10"
                />

                {customerQuery ? (
                  <div className="mt-3 overflow-hidden rounded-2xl border border-stone-200">
                    {matchingCustomers.length > 0 ? (
                      matchingCustomers.map((customer) => (
                        <button
                          key={customer.id}
                          type="button"
                          onClick={() => {
                            setSelectedCustomer(customer);
                            setCustomerQuery(getCustomerDisplayName(customer));
                          }}
                          className="flex w-full items-center justify-between bg-white px-4 py-3 text-left text-sm text-stone-700 transition hover:bg-stone-50"
                        >
                          <span>{getCustomerDisplayName(customer)}</span>
                          <span className="text-stone-400">{customer.phone || "No phone"}</span>
                        </button>
                      ))
                    ) : (
                      <div className="bg-white px-4 py-3 text-sm text-stone-400">
                        No matching customers found.
                      </div>
                    )}
                  </div>
                ) : null}
              </div>

              <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-right">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-400">
                  Quote Number
                </p>
                <p className="mt-2 text-lg font-semibold tracking-tight text-stone-950">
                  {quoteNumber}
                </p>
              </div>
            </div>

            {selectedCustomer ? (
              <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950">
                <p className="font-semibold">{getCustomerDisplayName(selectedCustomer)}</p>
                <p className="mt-1">{selectedCustomer.phone || "No phone on file"}</p>
                <p className="mt-1">{formatAddress(selectedCustomer) || "No address on file"}</p>
              </div>
            ) : null}
          </section>

          <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-stone-950">
                  Line item builder
                </h2>
                <p className="mt-1 text-sm text-stone-500">
                  Build one line at a time. Each step unlocks after the previous one is filled.
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-5">
              <div>
                <StepLabel step={1} label="Room" />
                <input
                  type="text"
                  value={form.room}
                  onChange={(event) => updateForm("room", event.target.value)}
                  className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                />
              </div>

              {form.room ? (
                <div>
                  <StepLabel step={2} label="Manufacturer" />
                  <select
                    value={form.manufacturerId}
                    onChange={(event) => updateForm("manufacturerId", event.target.value)}
                    className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                  >
                    <option value="">Select manufacturer</option>
                    {manufacturers.map((manufacturer) => (
                      <option key={manufacturer.id} value={manufacturer.id}>
                        {manufacturer.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              {form.manufacturerId ? (
                <div>
                  <StepLabel step={3} label="Product" />
                  <select
                    value={form.productId}
                    onChange={(event) => updateForm("productId", event.target.value)}
                    className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                  >
                    <option value="">Select product</option>
                    {availableProducts.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              {form.productId ? (
                <div>
                  <StepLabel step={4} label="Fabric" />
                  <select
                    value={form.fabricId}
                    onChange={(event) => updateForm("fabricId", event.target.value)}
                    className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                  >
                    <option value="">Select fabric</option>
                    {availableFabrics.map((fabric) => (
                      <option key={fabric.id} value={fabric.id}>
                        {fabric.name} ({fabric.fabric_code})
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              {form.fabricId ? (
                <div>
                  <StepLabel step={5} label="Lift option" />
                  <select
                    value={form.liftOptionId}
                    onChange={(event) => updateForm("liftOptionId", event.target.value)}
                    className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                  >
                    <option value="">Select lift option</option>
                    {availableLiftOptions.map((liftOption) => (
                      <option key={liftOption.id} value={liftOption.id}>
                        {liftOption.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              {form.liftOptionId ? (
                <div>
                  <StepLabel step={6} label="Mount type" />
                  <div className="grid gap-3 sm:grid-cols-2">
                    {(["Inside mount", "Outside mount"] as const).map((mountType) => (
                      <button
                        key={mountType}
                        type="button"
                        onClick={() => updateForm("mountType", mountType)}
                        className={`rounded-xl border px-4 py-3 text-sm font-medium transition ${
                          form.mountType === mountType
                            ? "border-primary bg-primary text-white"
                            : "border-stone-200 bg-white text-stone-700 hover:border-stone-300"
                        }`}
                      >
                        {mountType}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {form.mountType ? (
                <div>
                  <StepLabel step={7} label="Width" />
                  <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
                    <input
                      type="number"
                      min="0"
                      value={form.widthWhole}
                      onChange={(event) => updateForm("widthWhole", event.target.value)}
                      className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                    />
                    <select
                      value={form.widthFraction}
                      onChange={(event) =>
                        updateForm("widthFraction", event.target.value as FractionValue)
                      }
                      className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                    >
                      {FRACTION_OPTIONS.map((fraction) => (
                        <option key={fraction.value} value={fraction.value}>
                          {fraction.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : null}

              {form.widthWhole ? (
                <div>
                  <StepLabel step={8} label="Height" />
                  <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
                    <input
                      type="number"
                      min="0"
                      value={form.heightWhole}
                      onChange={(event) => updateForm("heightWhole", event.target.value)}
                      className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                    />
                    <select
                      value={form.heightFraction}
                      onChange={(event) =>
                        updateForm("heightFraction", event.target.value as FractionValue)
                      }
                      className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                    >
                      {FRACTION_OPTIONS.map((fraction) => (
                        <option key={fraction.value} value={fraction.value}>
                          {fraction.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : null}

              {form.heightWhole ? (
                <div>
                  <StepLabel step={9} label="Quantity" />
                  <input
                    type="number"
                    min="1"
                    value={form.quantity}
                    onChange={(event) => updateForm("quantity", event.target.value)}
                    className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                  />
                </div>
              ) : null}

              {form.quantity ? (
                <div>
                  <StepLabel step={10} label="Notes" />
                  <input
                    type="text"
                    value={form.notes}
                    onChange={(event) => updateForm("notes", event.target.value)}
                    placeholder="Optional notes"
                    className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700 outline-none placeholder:text-stone-400 focus:border-primary focus:ring-2 focus:ring-primary/10"
                  />
                </div>
              ) : null}
            </div>

            {selectedFabric && form.widthWhole && form.heightWhole ? (
              <div className="mt-6 rounded-2xl border border-stone-200 bg-stone-50 p-5">
                <p className="text-sm text-stone-400">
                  MSRP base price{" "}
                  <span className="font-medium text-stone-600">
                    {formatCurrency(priceResult?.msrp_base ?? 0)}
                  </span>
                </p>
                <p className="mt-3 text-3xl font-semibold tracking-tight text-primary">
                  {formatCurrency(priceResult?.sell_price ?? 0)}
                </p>
                {pricingError ? <p className="mt-3 text-sm text-rose-600">{pricingError}</p> : null}
              </div>
            ) : null}

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={resetForm}
                className="rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 transition hover:border-stone-300"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={handleAddLine}
                className="rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-95"
              >
                Add line
              </button>
            </div>
          </section>

          <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold tracking-tight text-stone-950">
              Line items
            </h2>

            <div className="mt-5 overflow-hidden rounded-2xl border border-stone-200">
              <table className="min-w-full divide-y divide-stone-200">
                <thead className="bg-stone-50">
                  <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">
                    <th className="px-4 py-4">Line #</th>
                    <th className="px-4 py-4">Room</th>
                    <th className="px-4 py-4">Product details</th>
                    <th className="px-4 py-4">Width</th>
                    <th className="px-4 py-4">Height</th>
                    <th className="px-4 py-4">Qty</th>
                    <th className="px-4 py-4">Unit price</th>
                    <th className="px-4 py-4">Line total</th>
                    <th className="px-4 py-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 bg-white">
                  {lineItems.length > 0 ? (
                    lineItems.map((line, index) => (
                      <tr key={line.id}>
                        <td className="px-4 py-4 text-sm text-stone-500">{index + 1}</td>
                        <td className="px-4 py-4 text-sm font-medium text-stone-950">
                          {line.room}
                        </td>
                        <td className="px-4 py-4 text-sm text-stone-600">
                          <div className="space-y-1">
                            <p>
                              {line.productName} • {line.fabricName} ({line.fabricCode})
                            </p>
                            <p className="text-stone-400">
                              {line.liftOptionName} • {line.mountType}
                              {line.notes ? ` • ${line.notes}` : ""}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-sm text-stone-600">
                          {formatMeasurement(line.widthWhole, line.widthFraction)}
                        </td>
                        <td className="px-4 py-4 text-sm text-stone-600">
                          {formatMeasurement(line.heightWhole, line.heightFraction)}
                        </td>
                        <td className="px-4 py-4 text-sm text-stone-600">{line.quantity}</td>
                        <td className="px-4 py-4 text-sm font-medium text-stone-950">
                          {formatCurrency(line.sellPrice)}
                        </td>
                        <td className="px-4 py-4 text-sm font-medium text-stone-950">
                          {formatCurrency(line.lineTotal)}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleEdit(line)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-stone-200 text-stone-500 transition hover:border-stone-300 hover:text-stone-700"
                              aria-label={`Edit line ${index + 1}`}
                            >
                              <svg
                                viewBox="0 0 20 20"
                                className="h-4 w-4"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.8"
                              >
                                <path
                                  d="M3.5 13.75V16.5h2.75L15 7.75 12.25 5 3.5 13.75Z"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                                <path
                                  d="M10.75 6.5 13.5 9.25"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(line.id)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-rose-200 text-rose-600 transition hover:bg-rose-50"
                              aria-label={`Delete line ${index + 1}`}
                            >
                              <svg
                                viewBox="0 0 20 20"
                                className="h-4 w-4"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.8"
                              >
                                <path
                                  d="M5.75 6.25v9.5h8.5v-9.5"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                                <path
                                  d="M4 6.25h12"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                                <path
                                  d="M7.75 6.25V4.5h4.5v1.75"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={9} className="px-4 py-10 text-center text-sm text-stone-400">
                        Add a line above to start building the quote.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-4 text-right text-sm text-stone-500">
              Running subtotal:{" "}
              <span className="font-semibold text-stone-950">{formatCurrency(subtotal)}</span>
            </div>

            <div className="mt-5">
              <button
                type="button"
                onClick={() => setShowAdvancedOptions((current) => !current)}
                className="rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 transition hover:border-stone-400"
              >
                Advanced options
              </button>
            </div>

            {showAdvancedOptions ? (
              <div className="mt-5 rounded-2xl border border-stone-200 bg-stone-50 p-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-stone-700">
                      Shipping amount
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={shipping}
                      onChange={(event) => setShipping(event.target.value)}
                      className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-700 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-stone-700">
                      Installation amount
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={installation}
                      onChange={(event) => setInstallation(event.target.value)}
                      className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-700 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                    />
                  </div>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-[220px_1fr]">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-stone-700">
                      Discount type
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setDiscountType("percent")}
                        className={`rounded-xl border px-4 py-3 text-sm font-medium transition ${
                          discountType === "percent"
                            ? "border-primary bg-primary text-white"
                            : "border-stone-200 bg-white text-stone-700"
                        }`}
                      >
                        %
                      </button>
                      <button
                        type="button"
                        onClick={() => setDiscountType("amount")}
                        className={`rounded-xl border px-4 py-3 text-sm font-medium transition ${
                          discountType === "amount"
                            ? "border-primary bg-primary text-white"
                            : "border-stone-200 bg-white text-stone-700"
                        }`}
                      >
                        $
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-stone-700">
                      Discount value
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={discountValue}
                      onChange={(event) => setDiscountValue(event.target.value)}
                      className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-700 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                    />
                  </div>
                </div>
              </div>
            ) : null}
          </section>

          <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold tracking-tight text-stone-950">
              Quote totals
            </h2>

            <div className="mt-6 rounded-2xl border border-stone-200 bg-stone-50 p-5">
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm text-stone-600">
                  <span>Subtotal</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex items-center justify-between text-sm text-stone-600">
                  <span>Tax</span>
                  <span>{formatCurrency(taxAmount)}</span>
                </div>
                <div className="flex items-center justify-between border-t border-stone-200 pt-3 text-lg font-semibold text-stone-950">
                  <span>Total</span>
                  <span>{formatCurrency(total)}</span>
                </div>
              </div>
            </div>

            {saveError ? <p className="mt-4 text-sm text-rose-600">{saveError}</p> : null}
            {isLoadingData ? <p className="mt-4 text-sm text-stone-400">Loading pricing data...</p> : null}
          </section>

          {lineItems.length > 0 ? (
            <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold tracking-tight text-stone-950">
                Customer agreement
              </h2>

              <div className="mt-5 rounded-2xl border border-stone-200 bg-stone-50 p-4">
                <p className="text-sm font-medium text-stone-700">Terms and conditions</p>
                <div className="mt-3 max-h-[150px] overflow-y-auto rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm leading-6 text-stone-600">
                  {businessSettings?.terms_and_conditions?.trim()
                    ? businessSettings.terms_and_conditions
                    : "Configure your terms and conditions in Settings → Company Setup"}
                </div>
              </div>

              <div className="mt-5 space-y-4">
                <label className="flex items-start gap-3 text-sm text-stone-700">
                  <input
                    type="checkbox"
                    checked={agreedToTerms}
                    onChange={(event) => setAgreedToTerms(event.target.checked)}
                    className="mt-1 h-4 w-4 accent-[#FF4900]"
                  />
                  <span>I have read and agree to the terms and conditions</span>
                </label>

                <label className="flex items-start gap-3 text-sm text-stone-700">
                  <input
                    type="checkbox"
                    checked={agreedToDisclaimer}
                    onChange={(event) => setAgreedToDisclaimer(event.target.checked)}
                    className="mt-1 h-4 w-4 accent-[#FF4900]"
                  />
                  <span>
                    I understand that all window treatments are custom fabricated and non-refundable
                  </span>
                </label>
              </div>

              <div className="mt-5">
                <label className="mb-2 block text-sm font-medium text-stone-700">
                  Customer name
                </label>
                <input
                  type="text"
                  value={agreementName}
                  onChange={(event) => setAgreementName(event.target.value)}
                  className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                />
              </div>

              <div className="mt-5 overflow-hidden rounded-2xl border border-stone-200 bg-stone-50">
                <div className="flex items-center justify-center border-b border-stone-200 bg-white px-4 py-3 text-sm text-stone-400">
                  Sign here
                </div>
                <canvas
                  ref={canvasRef}
                  width={900}
                  height={220}
                  className="h-44 w-full touch-none bg-white"
                  onMouseDown={(event) => startDrawing(event.clientX, event.clientY)}
                  onMouseMove={(event) => continueDrawing(event.clientX, event.clientY)}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={(event) => {
                    const touch = event.touches[0];
                    startDrawing(touch.clientX, touch.clientY);
                  }}
                  onTouchMove={(event) => {
                    const touch = event.touches[0];
                    continueDrawing(touch.clientX, touch.clientY);
                  }}
                  onTouchEnd={stopDrawing}
                />
              </div>

              <button
                type="button"
                onClick={clearSignature}
                className="mt-4 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 transition hover:border-stone-300"
              >
                Clear
              </button>

              {signatureError ? <p className="mt-4 text-sm text-rose-600">{signatureError}</p> : null}
              {signatureSuccess ? <p className="mt-4 text-sm text-emerald-600">{signatureSuccess}</p> : null}

              <button
                type="button"
                onClick={() => void handleSaveSignature()}
                disabled={isSavingSignature}
                className="mt-5 w-full rounded-xl bg-primary px-4 py-3 text-sm font-medium text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSavingSignature ? "Saving..." : "Save & get signature"}
              </button>
            </section>
          ) : null}

          <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void saveAndRedirect("pending")}
                disabled={isSaving}
                className="rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-70"
              >
                Save quote
              </button>
              <button
                type="button"
                onClick={() => void saveAndRedirect("ordered")}
                disabled={isSaving}
                className="rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 transition hover:border-stone-300 disabled:cursor-not-allowed disabled:opacity-70"
              >
                Create order
              </button>
              <Link
                href="/quotes"
                className="rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 transition hover:border-stone-300"
              >
                Cancel
              </Link>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
