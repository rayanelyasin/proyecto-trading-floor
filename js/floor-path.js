function clearSegment(a, b, blocked) {
  const steps = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.10);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    if (blocked(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t)) return false;
  }
  return true;
}

// Busca una ruta solo al recibir un destino, usando las mismas colisiones del jugador.
export function walkingPath(start, end, boundX, boundZ, blocked) {
  if (blocked(end.x, end.z)) return [];
  if (clearSegment(start, end, blocked)) return [end];
  const spacing = 0.65;
  const width = Math.floor(boundX * 2 / spacing) + 1;
  const height = Math.floor(boundZ * 2 / spacing) + 1;
  const point = (index) => ({ x: index % width * spacing - boundX, z: Math.floor(index / width) * spacing - boundZ });
  const startX = Math.round((start.x + boundX) / spacing);
  const startZ = Math.round((start.z + boundZ) / spacing);
  const previous = new Int32Array(width * height).fill(-2);
  const queue = [];

  // El jugador casi nunca está centrado en una celda del mapa.
  for (let y = Math.max(0, startZ - 1); y <= Math.min(height - 1, startZ + 1); y++) {
    for (let x = Math.max(0, startX - 1); x <= Math.min(width - 1, startX + 1); x++) {
      const index = y * width + x;
      if (!clearSegment(start, point(index), blocked)) continue;
      previous[index] = -1;
      queue.push(index);
    }
  }

  let found = -1;
  const directions = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  for (let current = 0; current < queue.length; current++) {
    const index = queue[current], from = point(index);
    if (Math.hypot(end.x - from.x, end.z - from.z) < spacing * 1.6 && clearSegment(from, end, blocked)) {
      found = index;
      break;
    }
    for (const [dx, dz] of directions) {
      const x = index % width + dx, z = Math.floor(index / width) + dz;
      if (x < 0 || x >= width || z < 0 || z >= height) continue;
      const next = z * width + x;
      if (previous[next] !== -2 || !clearSegment(from, point(next), blocked)) continue;
      previous[next] = index;
      queue.push(next);
    }
  }
  if (found < 0) return [];

  const cells = [end];
  for (let index = found; index !== -1; index = previous[index]) cells.push(point(index));
  cells.reverse();
  const path = [];
  let from = start;
  for (let cursor = 0; cursor < cells.length;) {
    let next = cells.length - 1;
    while (next > cursor && !clearSegment(from, cells[next], blocked)) next--;
    from = cells[next];
    path.push(from);
    cursor = next + 1;
  }
  return path;
}
