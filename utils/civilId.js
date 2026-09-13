const WEIGHTS = [2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];

function isValidCivilId(value) {
  const digits = String(value).replace(/\D/g, '');
  if (digits.length !== 12) return false;

  const nums = digits.split('').map(Number);
  const sum = nums.slice(0, 11).reduce((acc, d, i) => acc + d * WEIGHTS[i], 0);
  const expectedChecksum = 11 - (sum % 11);

  if (expectedChecksum >= 10) return false;
  return expectedChecksum === nums[11];
}

module.exports = { isValidCivilId };