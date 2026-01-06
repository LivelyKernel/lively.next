export function greet(name) {
  return `Hello, ${name}!`;
}

export const version = '0.1.0';

export default function main() {
  return greet('lively.next');
}
