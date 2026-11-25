/* Deterministic, realistic sample datasets (no randomness so screenshots and tests are stable). */

const first = ['Aarav', 'Priya', 'John', 'Maria', 'Wei', 'Fatima', 'Liam', 'Sofia', 'Kenji', 'Amara', 'Noah', 'Isha', 'Lucas', 'Zara', 'Omar', 'Elena', 'Ravi', 'Chloe', 'Mateo', 'Anika', 'Ethan', 'Mei', 'Diego', 'Nora', 'Arjun']
const last = ['Sharma', 'Patel', 'Doe', 'Garcia', 'Chen', 'Khan', 'Murphy', 'Rossi', 'Tanaka', 'Okafor', 'Smith', 'Mehta', 'Silva', 'Ali', 'Hassan', 'Petrov', 'Nair', 'Dubois', 'Lopez', 'Rao', 'Brown', 'Lin', 'Torres', 'Berg', 'Iyer']
const cities: [string, string, string][] = [
  ['Bengaluru', 'India', 'Karnataka'], ['Mumbai', 'India', 'Maharashtra'], ['London', 'United Kingdom', 'England'], ['Madrid', 'Spain', 'Madrid'],
  ['Shanghai', 'China', 'Shanghai'], ['Dubai', 'UAE', 'Dubai'], ['Dublin', 'Ireland', 'Leinster'], ['Rome', 'Italy', 'Lazio'], ['Tokyo', 'Japan', 'Kanto'],
  ['Lagos', 'Nigeria', 'Lagos'], ['Austin', 'United States', 'Texas'], ['Pune', 'India', 'Maharashtra'], ['Lisbon', 'Portugal', 'Lisboa'],
]
const roles = ['admin', 'editor', 'viewer', 'editor', 'viewer', 'viewer', 'admin']
const plans = ['free', 'pro', 'team', 'enterprise']
const tags = ['beta', 'newsletter', 'vip', 'early-access', 'api', 'mobile', 'trial']
const items = ['Mechanical Keyboard', 'USB-C Hub', 'Standing Desk Mat', 'Noise-Cancelling Headset', 'Webcam 4K', 'Laptop Stand', 'Monitor Light Bar', 'Ergonomic Mouse']

export function usersSample() {
  const users = first.map((f, i) => {
    const l = last[i]
    const [city, country, state] = cities[i % cities.length]
    const orderCount = i % 5 === 0 ? 0 : (i % 4) + 1
    return {
      id: i + 1,
      name: `${f} ${l}`,
      email: `${f.toLowerCase()}.${l.toLowerCase()}@example.com`,
      role: roles[i % roles.length],
      active: i % 6 !== 4,
      age: 21 + ((i * 7) % 33),
      score: Math.round((52 + ((i * 37) % 480) / 10) * 10) / 10,
      joinedAt: `2024-${String((i % 12) + 1).padStart(2, '0')}-${String(((i * 3) % 27) + 1).padStart(2, '0')}T${String(8 + (i % 10)).padStart(2, '0')}:15:00Z`,
      address: { city, state, country, geo: { lat: +(10 + i * 1.7).toFixed(3), lng: +(70 + i * 1.1).toFixed(3) } },
      subscription: { plan: plans[i % plans.length], seats: (i % 4) + 1, trial: i % 7 === 0 },
      tags: [tags[i % tags.length], tags[(i + 3) % tags.length]].slice(0, (i % 3) + 1),
      manager: i % 8 === 0 ? null : first[(i + 3) % first.length] + ' ' + last[(i + 3) % last.length],
      bio: i % 5 === 1 ? 'Full-stack engineer who enjoys building developer tools, writing about distributed systems, and contributing to open source projects in the evenings and on weekends.' : i % 9 === 3 ? undefined : '',
      orders: Array.from({ length: orderCount }, (_, k) => ({
        orderId: 1000 + i * 10 + k,
        item: items[(i + k) % items.length],
        amount: 500 * ((i + k) % 9) + 1299,
        status: ['paid', 'shipped', 'pending', 'refunded'][(i + k) % 4],
      })),
    }
  })
  return { users }
}

export function productsSample() {
  const names = ['Aurora Lamp', 'Nimbus Speaker', 'Atlas Backpack', 'Echo Mug', 'Pulse Watch', 'Drift Sneakers', 'Willow Chair', 'Ember Candle', 'Summit Jacket', 'Orbit Charger']
  const cats = ['Home', 'Audio', 'Travel', 'Kitchen', 'Wearables', 'Apparel']
  return Array.from({ length: 36 }, (_, i) => ({
    sku: `SKU-${String(1000 + i * 13)}`,
    name: `${names[i % names.length]} ${['Mini', 'Pro', 'Max', 'Lite'][i % 4]}`,
    category: cats[i % cats.length],
    price: Math.round((9.99 + ((i * 47) % 300) + (i % 3) * 0.5) * 100) / 100,
    inStock: i % 5 !== 3,
    quantity: i % 5 === 3 ? 0 : 5 + ((i * 11) % 90),
    rating: i % 7 === 6 ? null : Math.round((3 + ((i * 13) % 20) / 10) * 10) / 10,
    releasedOn: `2025-${String((i % 12) + 1).padStart(2, '0')}-${String(((i * 5) % 27) + 1).padStart(2, '0')}`,
    dimensions: { w: 10 + (i % 6), h: 5 + (i % 4), d: 3 + (i % 3), unit: 'cm' },
    colors: ['black', 'white', 'sage', 'navy'].slice(0, (i % 4) + 1),
  }))
}

export function apiSample() {
  const levels = ['info', 'info', 'warn', 'error', 'info', 'debug']
  const paths = ['/v1/users', '/v1/orders', '/v1/auth/token', '/v1/search', '/v1/webhooks', '/v1/export']
  return {
    status: 'ok',
    meta: { page: 1, perPage: 24, total: 1840, requestId: 'req_8f3a9c21', generatedAt: '2026-11-25T09:30:00Z' },
    data: Array.from({ length: 24 }, (_, i) => ({
      id: `evt_${(0x1a2b3c + i * 977).toString(16)}`,
      timestamp: `2026-11-25T09:${String(59 - i).padStart(2, '0')}:${String((i * 13) % 60).padStart(2, '0')}Z`,
      level: levels[i % levels.length],
      method: ['GET', 'POST', 'GET', 'PUT', 'DELETE', 'GET'][i % 6],
      path: paths[i % paths.length],
      statusCode: [200, 201, 200, 404, 500, 200, 429, 204][i % 8],
      durationMs: 12 + ((i * 53) % 740),
      client: { ip: `10.0.${i % 8}.${20 + i}`, userAgent: ['curl/8.4', 'Mozilla/5.0', 'PostmanRuntime/7.36', 'okhttp/4.12'][i % 4] },
      cached: i % 3 === 0,
      headers: { 'content-type': 'application/json', 'x-region': ['us-east-1', 'eu-west-1', 'ap-south-1'][i % 3] },
      errors: i % 8 === 4 || i % 8 === 3 ? [{ code: i % 8 === 4 ? 'INTERNAL' : 'NOT_FOUND', message: i % 8 === 4 ? 'Upstream timeout' : 'Resource missing' }] : [],
    })),
  }
}

export type SampleDef = { id: string; label: string; file: string; desc: string; make: () => unknown }
export const SAMPLES: SampleDef[] = [
  { id: 'users', label: 'Users with nested orders', file: 'sample-users.json', desc: '25 users · nested address, orders[]', make: usersSample },
  { id: 'products', label: 'Product catalog', file: 'sample-products.json', desc: '36 flat-ish records · nulls, dates', make: productsSample },
  { id: 'api', label: 'API response envelope', file: 'sample-api-response.json', desc: 'Object with meta + data[]', make: apiSample },
]
