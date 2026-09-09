// header rows run from the antenna toward USB-C with the board mounted as shown
export const controlWiring = [
  { pin: 'D2', input: 'IN1', row: 4, terminal: 1, color: '#ba9853', bends: [[20, -36, 26], [88, -64, 29], [89, -22, 31], [56, 1, 32]] },
  { pin: 'D3', input: 'IN2', row: 5, terminal: 2, color: '#537f6f', bends: [[7, -13, 28], [49, -18, 29], [48, 2, 29]] },
  { pin: 'D9', input: 'ENA', row: 11, terminal: 0, color: '#b9674e', bends: [[29, -57, 25], [46, -52, 31], [45, 4, 29]] },
  { pin: 'GND', input: 'GND', row: 3, color: '#343c40', bends: [[14, -6, 26], [28, 2, 30], [35, 13, 29]] },
];
