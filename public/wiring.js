// header rows run from the antenna toward USB-C with the board mounted as shown
export const controlWiring = [
  { pin: 'D2', input: 'IN1', row: 4, terminal: 1, color: '#dc8b24', bends: [[24, -20, 27], [76, -26, 32], [85, -19, 33], [57, 3, 31], [31, 6, 27]] },
  { pin: 'D3', input: 'IN2', row: 5, terminal: 2, color: '#e2bd24', bends: [[26, -23, 29], [77, -29, 34], [87, -21, 35], [59, 2, 33], [34, 6, 28]] },
  { pin: 'D9', input: 'ENA', row: 11, terminal: 0, color: '#c94c46', bends: [[30, -42, 26], [63, -64, 30], [69, -43, 32], [49, -12, 31], [29, 4, 29]] },
  { pin: 'GND', input: 'GND', row: 3, color: '#343c40', bends: [[18, -10, 28], [39, -17, 29], [43, -5, 31], [35, 13, 29]] },
];
