export interface Job {
  id: string;
  customer_name: string;
  address: string;
  estimated_duration: number;
  lat?: number;
  lng?: number;
}

/** @deprecated Use Job instead */
export type SmartJob = Job;

export interface ScheduledJob extends Job {
  start_time: string;
  end_time: string;
  drive_time_minutes: number;
  optimized_sequence: number;
}

export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 3959; // Earth radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function estimateDriveTime(distanceMiles: number): number {
  // Estimate 25 mph average in metro Phoenix with stops
  return Math.round((distanceMiles / 25) * 60);
}

export function nearestNeighborRoute(
  jobs: Job[],
  startLat: number,
  startLng: number,
): Job[] {
  if (jobs.length === 0) return [];
  const unvisited = [...jobs];
  const route: Job[] = [];
  let currentLat = startLat;
  let currentLng = startLng;

  while (unvisited.length > 0) {
    let nearestIdx = 0;
    let nearestDist = Infinity;
    unvisited.forEach((job, idx) => {
      if (job.lat && job.lng) {
        const dist = haversineDistance(currentLat, currentLng, job.lat, job.lng);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestIdx = idx;
        }
      }
    });
    const nearest = unvisited.splice(nearestIdx, 1)[0];
    route.push(nearest);
    currentLat = nearest.lat || currentLat;
    currentLng = nearest.lng || currentLng;
  }
  return route;
}

export function buildOptimizedSchedule(
  jobs: Job[],
  startLat: number,
  startLng: number,
  startTime: Date,
): ScheduledJob[] {
  const route = nearestNeighborRoute(jobs, startLat, startLng);
  const scheduled: ScheduledJob[] = [];
  let currentTime = new Date(startTime);
  let prevLat = startLat;
  let prevLng = startLng;

  route.forEach((job, idx) => {
    const dist =
      job.lat && job.lng
        ? haversineDistance(prevLat, prevLng, job.lat, job.lng)
        : 0;
    const driveTime = estimateDriveTime(dist);
    currentTime = new Date(currentTime.getTime() + driveTime * 60000);
    const startJobTime = new Date(currentTime);
    const endJobTime = new Date(
      currentTime.getTime() + job.estimated_duration * 60000,
    );

    scheduled.push({
      ...job,
      start_time: startJobTime.toISOString(),
      end_time: endJobTime.toISOString(),
      drive_time_minutes: driveTime,
      optimized_sequence: idx + 1,
    });

    currentTime = endJobTime;
    prevLat = job.lat || prevLat;
    prevLng = job.lng || prevLng;
  });
  return scheduled;
}
