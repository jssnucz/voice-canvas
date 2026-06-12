let counter = 0;

export function generateId(): string {
  counter++;
  return `elem_${Date.now()}_${counter}`;
}
