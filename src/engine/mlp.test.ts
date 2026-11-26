import { describe, expect, it } from 'vitest';
import { activate, Mlp, type Activation } from './mlp';
import { rng } from './random';
import { PRESETS } from './store';

const asInputs = (points: { x: number; y: number; c: number }[]) => ({
  X: points.map(p => [2 * p.x - 1, 2 * p.y - 1]),
  y: points.map(p => p.c),
});
const XOR = { X: [[-1, -1], [-1, 1], [1, -1], [1, 1]], y: [0, 1, 1, 0] };

function train(net: Mlp, data: { X: number[][]; y: number[] }, epochs: number, rate: number, batch = 16) {
  const losses = [net.loss(data.X, data.y)];
  for (let e = 0; e < epochs; e++) losses.push(net.epoch(data.X, data.y, rate, batch));
  return losses;
}

describe('multi-layer perceptron', () => {
  it('learns the four XOR corners with one hidden layer', () => {
    const net = new Mlp({ inputs: 2, hidden: [4], activation: 'tanh', seed: 3 });
    const losses = train(net, XOR, 600, 0.5, 4);
    expect(net.accuracy(XOR.X, XOR.y)).toBe(1);
    expect(losses[losses.length - 1]).toBeLessThan(0.1);
  });

  it('cannot learn XOR without a hidden layer (one neuron draws one straight line)', () => {
    const net = new Mlp({ inputs: 2, hidden: [], seed: 3 });
    train(net, XOR, 600, 0.5, 4);
    expect(net.accuracy(XOR.X, XOR.y)!).toBeLessThanOrEqual(0.75);
  });

  it('separates the circles preset with ReLU units, and the loss falls', () => {
    const data = asInputs(PRESETS.circles(rng(7)));
    const net = new Mlp({ inputs: 2, hidden: [8, 8], activation: 'relu', seed: 5 });
    const losses = train(net, data, 300, 0.1);
    expect(net.accuracy(data.X, data.y)!).toBeGreaterThanOrEqual(0.95);
    expect(losses[losses.length - 1]).toBeLessThan(losses[0] / 3);
    // A single neuron stays near chance on the same rings.
    const single = new Mlp({ inputs: 2, hidden: [], seed: 5 });
    train(single, data, 300, 0.1);
    expect(single.accuracy(data.X, data.y)!).toBeLessThan(0.7);
  });

  it('uses softmax for several classes', () => {
    const X = [[-1, -1], [1, -1], [0, 1], [-0.9, -1.1], [1.1, -0.9], [0.1, 0.9]];
    const y = [0, 1, 2, 0, 1, 2];
    const net = new Mlp({ inputs: 2, hidden: [6], output: 'softmax', classes: 3, seed: 2 });
    train(net, { X, y }, 300, 0.3, 3);
    expect(net.accuracy(X, y)).toBe(1);
    const p = net.forward([0, 1]);
    expect(p).toHaveLength(3);
    expect(p.reduce((s, v) => s + v, 0)).toBeCloseTo(1);
  });

  it.each<Activation>(['relu', 'tanh', 'sigmoid', 'leaky'])('%s matches a numerical gradient', activation => {
    const net = new Mlp({ inputs: 2, hidden: [3, 2], activation, seed: 9 });
    const X = [[0.3, -0.7]], y = [1];
    const layer = net.layers[0];
    const before = layer.w[1];
    const h = 1e-5;
    layer.w[1] = before + h; const up = net.loss(X, y);
    layer.w[1] = before - h; const down = net.loss(X, y);
    layer.w[1] = before;
    const numeric = (up - down) / (2 * h);
    net.step(X, y, 1);
    expect(before - layer.w[1]).toBeCloseTo(numeric, 6);
  });

  it('sigmoid and leaky ReLU hidden layers learn XOR', () => {
    // Sigmoid learns slowly — a teaching point in the lesson.
    const sig = new Mlp({ inputs: 2, hidden: [6], activation: 'sigmoid', seed: 3 });
    train(sig, XOR, 2000, 1, 4);
    expect(sig.accuracy(XOR.X, XOR.y)).toBe(1);

    const leaky = new Mlp({ inputs: 2, hidden: [6], activation: 'leaky', seed: 3 });
    train(leaky, XOR, 600, 0.3, 4);
    expect(leaky.accuracy(XOR.X, XOR.y)).toBe(1);
  });

  it('activate gives the textbook values', () => {
    expect(activate('sigmoid', 0)).toBe(0.5);
    expect(activate('leaky', -2)).toBeCloseTo(-0.2);
    expect(activate('relu', -2)).toBe(0);
    expect(activate('tanh', 0)).toBe(0);
  });

  it('is deterministic for a seed', () => {
    const run = () => {
      const net = new Mlp({ inputs: 2, hidden: [5], seed: 11 });
      return train(net, XOR, 20, 0.3, 2);
    };
    expect(run()).toEqual(run());
    const other = new Mlp({ inputs: 2, hidden: [5], seed: 12 });
    expect(train(other, XOR, 20, 0.3, 2)).not.toEqual(run());
  });

  it('handles edge cases: empty data, one class, zero rate, bad sizes', () => {
    const net = new Mlp({ inputs: 2, hidden: [2], seed: 1 });
    expect(net.loss([], [])).toBe(0);
    expect(net.accuracy([], [])).toBeNull();
    expect(() => net.epoch([], [], 0.1)).not.toThrow();
    const w = Float64Array.from(net.layers[0].w);
    net.step(XOR.X, XOR.y, 0);
    expect(net.layers[0].w).toEqual(w);
    const one = { X: [[0, 0], [0.5, 0.5], [-0.5, 0.2]], y: [1, 1, 1] };
    train(net, one, 50, 0.5, 2);
    expect(net.accuracy(one.X, one.y)).toBe(1);
    expect(() => new Mlp({ inputs: 0, hidden: [] })).toThrow();
    expect(() => new Mlp({ inputs: 2, hidden: [0] })).toThrow();
  });

  it('keeps the loss finite when a huge learning rate saturates the outputs', () => {
    const net = new Mlp({ inputs: 2, hidden: [4], activation: 'tanh', seed: 1 });
    for (let i = 0; i < 20; i++) net.epoch(XOR.X, XOR.y, 1e6, 4);
    expect(Number.isFinite(net.loss(XOR.X, XOR.y))).toBe(true);
  });
});
