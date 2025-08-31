interface DocumentLine {
  line_amount: number;
  qty: number;
  net_mass_kg?: number;
}

export type AllocationMode = 'value' | 'weight' | 'quantity';

export function allocateShipping(
  lines: DocumentLine[],
  totalShipping: number,
  mode: AllocationMode = 'value'
): number[] {
  if (!lines.length || totalShipping <= 0) {
    return lines.map(() => 0);
  }

  let allocation: number[] = [];
  let total = 0;

  switch (mode) {
    case 'value':
      total = lines.reduce((sum, line) => sum + (line.line_amount || 0), 0);
      allocation = lines.map(line => 
        total > 0 ? (line.line_amount || 0) / total * totalShipping : 0
      );
      break;

    case 'weight':
      total = lines.reduce((sum, line) => sum + (line.net_mass_kg || 0), 0);
      if (total === 0) {
        // Fallback to value-based if no weights
        return allocateShipping(lines, totalShipping, 'value');
      }
      allocation = lines.map(line => 
        (line.net_mass_kg || 0) / total * totalShipping
      );
      break;

    case 'quantity':
      total = lines.reduce((sum, line) => sum + (line.qty || 0), 0);
      allocation = lines.map(line => 
        total > 0 ? (line.qty || 0) / total * totalShipping : 0
      );
      break;

    default:
      allocation = lines.map(() => 0);
  }

  // Round to 2 decimal places and adjust for rounding errors
  allocation = allocation.map(amount => Math.round(amount * 100) / 100);
  
  // Distribute any remaining cents due to rounding
  const allocatedTotal = allocation.reduce((sum, amount) => sum + amount, 0);
  const difference = Math.round((totalShipping - allocatedTotal) * 100) / 100;
  
  if (Math.abs(difference) > 0.01 && allocation.length > 0) {
    // Add the difference to the largest allocation
    const maxIndex = allocation.reduce((maxIdx, current, idx) => 
      current > allocation[maxIdx] ? idx : maxIdx, 0
    );
    allocation[maxIndex] += difference;
    allocation[maxIndex] = Math.round(allocation[maxIndex] * 100) / 100;
  }

  return allocation;
}

export function validateAllocations(
  allocations: number[],
  expectedTotal: number,
  tolerance: number = 0.02
): { valid: boolean; actualTotal: number; difference: number } {
  const actualTotal = allocations.reduce((sum, amount) => sum + amount, 0);
  const difference = Math.abs(actualTotal - expectedTotal);
  
  return {
    valid: difference <= tolerance,
    actualTotal: Math.round(actualTotal * 100) / 100,
    difference: Math.round(difference * 100) / 100
  };
}

export function adjustForCents(
  allocations: number[],
  expectedTotal: number
): number[] {
  const result = [...allocations];
  const actualTotal = result.reduce((sum, amount) => sum + amount, 0);
  const difference = Math.round((expectedTotal - actualTotal) * 100);
  
  if (Math.abs(difference) <= result.length && result.length > 0) {
    // Distribute cents one by one to avoid large adjustments
    const step = difference > 0 ? 1 : -1;
    let remaining = Math.abs(difference);
    let index = 0;
    
    while (remaining > 0 && index < result.length) {
      result[index] += step * 0.01;
      result[index] = Math.round(result[index] * 100) / 100;
      remaining--;
      index = (index + 1) % result.length;
    }
  }
  
  return result;
}