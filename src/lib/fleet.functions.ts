import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {maskVin} from './pass4r-rules';

/* ---- Drivers ---- */
export const listDrivers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("drivers").select("*").order("last_name");
    if (error) throw error;
    return data ?? [];
  });

export const upsertDriver = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    id?: string;
    first_name: string;
    last_name: string;
    phone?: string;
    email?: string;
    license_number?: string;
    license_expiry?: string | null;
    status?: "active" | "inactive" | "on_leave";
    notes?: string;
    employment_type?:
      | "independent_contractor"
      | "employee_w2"
      | "part_time"
      | "full_time"
      | "temporary"
      | "seasonal"
      | null;
    pay_type?: "hourly" | "daily_salary" | "per_trip" | "per_pickup_leg" | "per_mile" | "hybrid" | null;
    availability?: {
      mode: "weekly" | "flexible";
      days: Record<string, { off?: boolean; start?: string; end?: string }>;
    } | null;
    service_capabilities?: Array<"ambulatory" | "wheelchair" | "stretcher">;
    primary_vehicle_id?: string | null;
    vacation_start?: string | null;
    vacation_end?: string | null;
    contractor_pricing?: {
      hourly_rate_cents?: number | null;
      daily_rate_cents?: number | null;
      per_pickup_leg_cents?: number | null;
      per_trip_cents?: number | null;
      per_mile_cents?: number | null;
      wait_time_per_hour_cents?: number | null;
      cancellation_fee_cents?: number | null;
      notes?: string | null;
    } | null;
  }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const row: any = { ...data, owner_id: userId, status: data.status ?? "active" };
    if (data.employment_type === undefined) delete row.employment_type;
    if (data.pay_type === undefined) delete row.pay_type;
    if (data.availability === undefined) delete row.availability;
    if (data.service_capabilities === undefined) delete row.service_capabilities;
    if (data.contractor_pricing === undefined) delete row.contractor_pricing;
    if (data.primary_vehicle_id === undefined) delete row.primary_vehicle_id;
    if (data.vacation_start === undefined) delete row.vacation_start;
    if (data.vacation_end === undefined) delete row.vacation_end;
    if (data.employment_type && data.employment_type !== "independent_contractor") {
      row.contractor_pricing = {};
    }
    const q = data.id
      ? supabase.from("drivers").update(row).eq("id", data.id).select().single()
      : supabase.from("drivers").insert(row).select().single();
    const { data: out, error } = await q;
    if (error) throw error;

    if (out?.workspace_id && data.primary_vehicle_id !== undefined) {
      const driverId = (out as any).id as string;
      const vehId = data.primary_vehicle_id;
      if (vehId) {
        await supabase.from("vehicles")
          .update({ assigned_driver_id: null })
          .eq("workspace_id", out.workspace_id).eq("assigned_driver_id", driverId).neq("id", vehId);
        await supabase.from("vehicles")
          .update({ assigned_driver_id: driverId })
          .eq("id", vehId).eq("workspace_id", out.workspace_id);
      } else {
        await supabase.from("vehicles")
          .update({ assigned_driver_id: null })
          .eq("workspace_id", out.workspace_id).eq("assigned_driver_id", driverId);
      }
    }
    return out;
  });


export const deleteDriver = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("drivers").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

/* ---- Vehicles ---- */
export const listVehicles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("vehicles").select("*").order("name");
    if (error) throw error;
    return await Promise.all((data??[]).map(async v=>{const {data:masked}=await context.supabase.rpc('vehicle_masked_vin',{_vehicle:v.id});return {...v,vin:undefined,masked_vin:masked??'Not recorded'};}));
  });

export const getVehicleForEditing=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((i:{id:string})=>i).handler(async({data,context})=>{
 const {data:v,error}=await context.supabase.from('vehicles').select('*').eq('id',data.id).single();if(error||!v||!v.workspace_id)throw new Error('Vehicle unavailable');const {data:allowed}=await context.supabase.rpc('business_record_access',{_ws:v.workspace_id,_kind:'vehicles',_id:v.id,_level:'manage'});if(!allowed)throw new Error('Authorized vehicle editing required');const {data:privateRow}=await context.supabase.from('vehicle_private_identifiers').select('vin').eq('vehicle_id',v.id).maybeSingle();return {...v,vin:privateRow?.vin??''};
});

export const upsertVehicle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    id?: string;
    name: string;
    make?: string; model?: string; model_year?: number; vehicle_category?: string; accessibility_equipment?: string;
    plate?: string;
    vehicle_type?: "sedan" | "suv" | "van" | "wheelchair_van" | "stretcher_van" | "ambulance";
    capacity?: number;
    wheelchair_capacity?: number;
    status?: "active" | "inactive" | "maintenance";
    notes?: string;
    assigned_driver_id?: string | null;
    vin?:string; insurance_credential_id?:string|null; insurance_expiry?:string|null; service_regions?:string[];service_counties?:string[];service_cities?:string[];service_zips?:string[];travel_radius_miles?:number|null;
    service_capabilities?: Array<"ambulatory" | "wheelchair" | "stretcher">;
  }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const row: any = { ...data, owner_id: userId, vehicle_type: data.vehicle_type ?? "sedan", status: data.status ?? "active" };
    delete row.vin;
    if(data.vin && !/^[A-HJ-NPR-Z0-9]{17}$/i.test(data.vin))throw new Error('VIN must contain 17 valid letters and digits.');
    if(data.travel_radius_miles!=null&&(!Number.isInteger(data.travel_radius_miles)||data.travel_radius_miles<0||data.travel_radius_miles>500))throw new Error('Travel radius must be 0–500 miles.');
    for(const key of ['service_regions','service_counties','service_cities','service_zips'] as const)if(data[key]&&(data[key].length>100||data[key].some(v=>v.length>120)))throw new Error('Service area values are too long.');
    if (!data.make?.trim() || !data.model?.trim() || !data.plate?.trim() || !['ambulatory','wheelchair','stretcher','other'].includes(data.vehicle_category ?? '') || !Number.isInteger(data.model_year) || Number(data.model_year)<1900 || Number(data.model_year)>new Date().getUTCFullYear()+1 || !Number.isInteger(data.capacity) || Number(data.capacity)<1 || Number(data.capacity)>100) throw new Error('Vehicle category, make/model/year, plate and passenger capacity are required.');
    if (data.wheelchair_capacity !== undefined && (!Number.isInteger(data.wheelchair_capacity) || data.wheelchair_capacity < 0)) throw new Error('Wheelchair positions must be a nonnegative whole number.');
    if (data.service_capabilities === undefined) delete row.service_capabilities;
    if (data.assigned_driver_id === undefined) delete row.assigned_driver_id;
    const q = data.id
      ? supabase.from("vehicles").update(row).eq("id", data.id).select().single()
      : supabase.from("vehicles").insert(row).select().single();
    const { data: out, error } = await q;
    if (error) throw error;

    if(data.vin?.trim()&&out?.workspace_id){const {error:vinError}=await supabase.from('vehicle_private_identifiers').upsert({vehicle_id:out.id,workspace_id:out.workspace_id,vin:data.vin.toUpperCase()});if(vinError)throw new Error('Vehicle saved, but private VIN could not be saved. Reopen authorized editing to retry.');}
    if (out?.workspace_id && data.assigned_driver_id !== undefined) {
      const vehId = (out as any).id as string;
      const driverId = data.assigned_driver_id;
      if (driverId) {
        // Clear this vehicle from any other driver's primary_vehicle_id.
        await supabase.from("drivers")
          .update({ primary_vehicle_id: null })
          .eq("workspace_id", out.workspace_id).eq("primary_vehicle_id", vehId).neq("id", driverId);
        // Set primary_vehicle_id on the assigned driver.
        await supabase.from("drivers")
          .update({ primary_vehicle_id: vehId })
          .eq("id", driverId).eq("workspace_id", out.workspace_id);
      } else {
        // Cleared: unlink any driver that had this vehicle as primary.
        await supabase.from("drivers")
          .update({ primary_vehicle_id: null })
          .eq("workspace_id", out.workspace_id).eq("primary_vehicle_id", vehId);
      }
    }
    return out;
  });


export const deleteVehicle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("vehicles").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

/* ---- Trip assignment ---- */
export const assignDriverVehicle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { trip_id: string; driver_id?: string | null; vehicle_id?: string | null }) => input)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: prior } = await supabase
      .from("trips").select("driver_id").eq("id", data.trip_id).single();
    const { error } = await supabase
      .from("trips")
      .update({ driver_id: data.driver_id ?? null, vehicle_id: data.vehicle_id ?? null })
      .eq("id", data.trip_id);
    if (error) throw error;

    if (data.driver_id && data.driver_id !== prior?.driver_id) {
      const { data: trip } = await supabase
        .from("trips").select("*").eq("id", data.trip_id).single();
      const { data: driver } = await supabase
        .from("drivers").select("first_name,email").eq("id", data.driver_id).single();
      if (trip && driver?.email) {
        const subject = `New trip assignment — ${trip.pickup_date} ${String(trip.pickup_time).slice(0, 5)}`;
        const body = [
          `Hi ${driver.first_name},`,
          ``,
          `You've been assigned a new trip on My Florida NEMT.`,
          ``,
          `Patient: ${trip.patient_first_name} ${trip.patient_last_name}${trip.patient_phone ? ` (${trip.patient_phone})` : ""}`,
          `When: ${trip.pickup_date} at ${String(trip.pickup_time).slice(0, 5)}`,
          `Pickup: ${trip.pickup_address}, ${trip.pickup_city}${trip.pickup_zip ? " " + trip.pickup_zip : ""}`,
          `Drop-off: ${trip.dropoff_address}, ${trip.dropoff_city}${trip.dropoff_zip ? " " + trip.dropoff_zip : ""}`,
          trip.transport_type ? `Transport: ${trip.transport_type}` : null,
          trip.round_trip ? `Round trip: yes` : null,
          trip.mobility_notes ? `Mobility: ${trip.mobility_notes}` : null,
          trip.special_instructions ? `Notes: ${trip.special_instructions}` : null,
        ].filter(Boolean).join("\n");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin.from("notification_email_queue").insert({
          recipient_email: driver.email, subject, body,
        });
      }
    }
    return { ok: true };
  });

/* ---- Weekly schedule email to driver ---- */
export const sendDriverWeeklySchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { driver_id: string; week_start: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: driver, error: dErr } = await supabase
      .from("drivers").select("first_name,email,owner_id")
      .eq("id", data.driver_id).eq("owner_id", userId).single();
    if (dErr || !driver) throw new Error("Driver not found");
    if (!driver.email) throw new Error("Driver has no email on file");

    const start = new Date(data.week_start + "T00:00:00");
    const end = new Date(start); end.setDate(end.getDate() + 7);
    const endStr = end.toISOString().slice(0, 10);

    const { data: trips, error: tErr } = await supabase
      .from("trips").select("*")
      .eq("driver_id", data.driver_id)
      .gte("pickup_date", data.week_start).lt("pickup_date", endStr)
      .order("pickup_date").order("pickup_time");
    if (tErr) throw tErr;

    const lines: string[] = [
      `Hi ${driver.first_name},`,
      ``,
      `Here is your trip schedule for the week of ${data.week_start}:`,
      ``,
    ];
    if (!trips || trips.length === 0) {
      lines.push("No trips assigned for this week.");
    } else {
      for (const t of trips) {
        lines.push(`— ${t.pickup_date} ${String(t.pickup_time).slice(0, 5)} · ${t.patient_first_name} ${t.patient_last_name}${t.patient_phone ? ` (${t.patient_phone})` : ""}`);
        lines.push(`   Pickup: ${t.pickup_address}, ${t.pickup_city}${t.pickup_zip ? " " + t.pickup_zip : ""}`);
        lines.push(`   Drop-off: ${t.dropoff_address}, ${t.dropoff_city}${t.dropoff_zip ? " " + t.dropoff_zip : ""}`);
        if (t.transport_type) lines.push(`   Transport: ${t.transport_type}${t.round_trip ? " · round trip" : ""}`);
        if (t.mobility_notes) lines.push(`   Mobility: ${t.mobility_notes}`);
        if (t.special_instructions) lines.push(`   Notes: ${t.special_instructions}`);
        lines.push("");
      }
    }
    lines.push("— My Florida NEMT");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: qErr } = await supabaseAdmin.from("notification_email_queue").insert({
      recipient_email: driver.email,
      subject: `Your My Florida NEMT schedule — week of ${data.week_start} (${trips?.length ?? 0} trip${(trips?.length ?? 0) === 1 ? "" : "s"})`,
      body: lines.join("\n"),
    });
    if (qErr) throw qErr;
    return { ok: true, count: trips?.length ?? 0 };
  });

