import { hash2 } from './pixelCanvas.ts';

/**
 * Coursed masonry in surface coordinates. Course heights and block lengths
 * vary per course from a seed, the way real ashlar walls do, and are
 * precomputed so neighbouring pixels can be compared cheaply: a joint is
 * simply where the block id changes.
 */
export class Masonry {
  private readonly courseEdges: number[] = [];
  private readonly joints = new Map<number, number[]>();

  private readonly seed: number;
  private readonly courseMax: number;
  private readonly lenMin: number;
  private readonly lenMax: number;
  private readonly uMin: number;
  private readonly uMax: number;

  constructor(
    seed: number,
    vMin: number,
    vMax: number,
    courseMin: number,
    courseMax: number,
    lenMin: number,
    lenMax: number,
    uMin = -40,
    uMax = 60,
  ) {
    this.seed = seed;
    this.courseMax = courseMax;
    this.lenMin = lenMin;
    this.lenMax = lenMax;
    this.uMin = uMin;
    this.uMax = uMax;
    let v = vMin;
    let i = 0;
    while (v < vMax + courseMax) {
      this.courseEdges.push(v);
      v += courseMin + hash2(i, 7, seed) * (courseMax - courseMin);
      i++;
    }
  }

  course(v: number) {
    // Binary search over course edges.
    let lo = 0;
    let hi = this.courseEdges.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this.courseEdges[mid] <= v) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  }

  private jointsFor(course: number) {
    let list = this.joints.get(course);
    if (!list) {
      list = [];
      let u = this.uMin - hash2(course, 3, this.seed) * this.lenMax;
      let i = 0;
      while (u < this.uMax) {
        list.push(u);
        u +=
          this.lenMin +
          hash2(course, i + 11, this.seed) * (this.lenMax - this.lenMin);
        i++;
      }
      this.joints.set(course, list);
    }
    return list;
  }

  /** Stable id of the block containing (u, v). */
  id(u: number, v: number) {
    const c = this.course(v);
    const list = this.jointsFor(c);
    let lo = 0;
    let hi = list.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (list[mid] <= u) lo = mid;
      else hi = mid - 1;
    }
    return c * 4096 + lo;
  }

  /** 0..1 position inside the block's course (0 = top edge). */
  courseFraction(v: number) {
    const c = this.course(v);
    const top = this.courseEdges[c];
    const bottom = this.courseEdges[c + 1] ?? top + this.courseMax;
    return (v - top) / (bottom - top);
  }
}
