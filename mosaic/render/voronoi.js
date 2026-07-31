const SQRT3 = Math.sqrt(3);
const HCP_C = Math.sqrt(8 / 3);

function determinant3(matrix) {
  const [[a, b, c], [d, e, f], [g, h, i]] = matrix;
  return a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
}

function solve3(matrix, vector) {
  const determinant = determinant3(matrix);
  if (Math.abs(determinant) < 1e-10) return null;
  const columns = [0, 1, 2].map((column) => matrix.map((row, rowIndex) => (
    row.map((value, colIndex) => (colIndex === column ? vector[rowIndex] : value))
  )));
  return columns.map((candidate) => determinant3(candidate) / determinant);
}

function dot(left, right) {
  return left[0] * right[0] + left[1] * right[1] + left[2] * right[2];
}

function scale(vector, amount) {
  return vector.map((value) => value * amount);
}

function uniquePoints(points, tolerance = 1e-6) {
  const result = [];
  for (const point of points) {
    if (!result.some((other) => (
      Math.abs(point[0] - other[0]) < tolerance
      && Math.abs(point[1] - other[1]) < tolerance
      && Math.abs(point[2] - other[2]) < tolerance
    ))) result.push(point);
  }
  return result;
}

export function voronoiVerticesFromNeighbors(neighbors) {
  const planes = neighbors.map((normal) => ({ normal, distance: dot(normal, normal) / 2 }));
  const candidates = [];

  for (let a = 0; a < planes.length - 2; a += 1) {
    for (let b = a + 1; b < planes.length - 1; b += 1) {
      for (let c = b + 1; c < planes.length; c += 1) {
        const selected = [planes[a], planes[b], planes[c]];
        const point = solve3(
          selected.map((plane) => plane.normal),
          selected.map((plane) => plane.distance),
        );
        if (!point) continue;
        const inside = planes.every((plane) => dot(point, plane.normal) <= plane.distance + 1e-7);
        if (inside) candidates.push(point);
      }
    }
  }

  const vertices = uniquePoints(candidates);
  if (vertices.length < 4) throw new Error('The neighbor set did not define a bounded Voronoi polyhedron.');
  return vertices;
}

export function latticeNeighborVectors(kind, basis = 0) {
  switch (kind) {
    case 'sc':
      return [
        [1, 0, 0], [-1, 0, 0],
        [0, 1, 0], [0, -1, 0],
        [0, 0, 1], [0, 0, -1],
      ];
    case 'fcc': {
      const vectors = [];
      for (const zeroAxis of [0, 1, 2]) {
        const axes = [0, 1, 2].filter((axis) => axis !== zeroAxis);
        for (const first of [-0.5, 0.5]) {
          for (const second of [-0.5, 0.5]) {
            const vector = [0, 0, 0];
            vector[axes[0]] = first;
            vector[axes[1]] = second;
            vectors.push(vector);
          }
        }
      }
      return vectors;
    }
    case 'bcc': {
      const vectors = [];
      for (const x of [-0.5, 0.5]) {
        for (const y of [-0.5, 0.5]) {
          for (const z of [-0.5, 0.5]) vectors.push([x, y, z]);
        }
      }
      vectors.push(
        [1, 0, 0], [-1, 0, 0],
        [0, 1, 0], [0, -1, 0],
        [0, 0, 1], [0, 0, -1],
      );
      return vectors;
    }
    case 'hcp': {
      const a1 = [1, 0, 0];
      const a2 = [0.5, SQRT3 / 2, 0];
      const basal = [
        a1, scale(a1, -1), a2, scale(a2, -1),
        [a2[0] - a1[0], a2[1] - a1[1], 0],
        [a1[0] - a2[0], a1[1] - a2[1], 0],
      ];
      const b = [(a1[0] + a2[0]) / 3, (a1[1] + a2[1]) / 3, 0];
      const projectionsA = [
        [b[0], b[1]],
        [b[0] - a1[0], b[1] - a1[1]],
        [b[0] - a2[0], b[1] - a2[1]],
      ];
      const projections = basis === 0
        ? projectionsA
        : projectionsA.map(([x, y]) => [-x, -y]);
      const interlayer = [];
      for (const [x, y] of projections) {
        interlayer.push([x, y, HCP_C / 2], [x, y, -HCP_C / 2]);
      }
      return [...basal, ...interlayer];
    }
    default:
      throw new Error(`No Voronoi neighbor set for lattice ${kind}.`);
  }
}

export function latticeVoronoiVertices(kind, basis = 0) {
  return voronoiVerticesFromNeighbors(latticeNeighborVectors(kind, basis));
}
