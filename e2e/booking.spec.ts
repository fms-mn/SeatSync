import { test, expect } from '@playwright/test';

test('guest registers, reserves a seat, checks out, and receives a ticket', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', {name:/book tickets/i}).click();
  await page.getByRole('link', {name:/lumière hall/i}).first().click();
  await page.getByRole('button', {name:/seat a1, available/i}).click();
  await page.getByRole('button', {name:/sign in to reserve/i}).click();
  await page.getByRole('button', {name:/create account/i}).click();
  const stamp = Date.now();
  await page.getByLabel('Full name').fill('E2E Guest');
  await page.getByLabel('Email address').fill(`guest-${stamp}@example.com`);
  await page.getByLabel('Password').fill('Password123!');
  await page.getByRole('button', {name:/create account/i}).click();
  await page.goto('/movies');
  await page.getByRole('link', {name:/echoes of orion/i}).click();
  await page.getByRole('link', {name:/lumière hall/i}).first().click();
  await page.getByRole('button', {name:/seat a1, available/i}).click();
  await page.getByRole('button', {name:/hold seats/i}).click();
  await expect(page.getByRole('heading', {name:/review & confirm/i})).toBeVisible();
  await page.getByRole('button', {name:/confirm & pay/i}).click();
  await expect(page.getByRole('heading', {name:/you’re going to the movies/i})).toBeVisible();
  await expect(page.getByText(/SS-/)).toBeVisible();
});
