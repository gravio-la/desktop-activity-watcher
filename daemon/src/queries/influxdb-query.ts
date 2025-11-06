/**
 * InfluxDB Query Functions
 */

import { InfluxDB } from '@influxdata/influxdb-client';
import type { InfluxDBConfig } from '../database/config';

export interface QueryOptions {
  eventType?: string;
  since: Date;
  limit?: number;
}

export interface QueryResult {
  time: string;
  event_type: string;
  data: any;
}

export async function queryInfluxDB(
  config: InfluxDBConfig,
  options: QueryOptions
): Promise<QueryResult[]> {
  const client = new InfluxDB({
    url: config.url,
    token: config.token,
  });

  const queryApi = client.getQueryApi(config.org);
  
  // Build Flux query
  let measurement = '*';
  if (options.eventType === 'window_activated') measurement = 'window_event';
  else if (options.eventType === 'file_accessed') measurement = 'file_event';
  else if (options.eventType === 'correlated') measurement = 'correlated_event';
  
  const sinceStr = options.since.toISOString();
  const limit = options.limit || 20;
  
  const query = `
    from(bucket: "${config.bucket}")
      |> range(start: ${sinceStr})
      |> filter(fn: (r) => r._measurement == "${measurement}" or "${measurement}" == "*")
      |> sort(columns: ["_time"], desc: true)
      |> limit(n: ${limit})
  `;

  const results: QueryResult[] = [];
  const rows: any[] = [];

  return new Promise((resolve, reject) => {
    queryApi.queryRows(query, {
      next(row: string[], tableMeta: any) {
        const o = tableMeta.toObject(row);
        rows.push(o);
      },
      error(error: Error) {
        reject(error);
      },
      complete() {
        // Group by time and measurement
        const grouped = new Map<string, any>();
        
        rows.forEach(row => {
          const key = `${row._time}-${row._measurement}`;
          if (!grouped.has(key)) {
            grouped.set(key, {
              time: new Date(row._time).toISOString(),
              event_type: row.event_type || row._measurement,
              data: {},
            });
          }
          
          const event = grouped.get(key)!;
          if (row._field) {
            event.data[row._field] = row._value;
          }
        });
        
        resolve(Array.from(grouped.values()));
      },
    });
  });
}

