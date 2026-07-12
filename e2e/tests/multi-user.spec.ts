import { expect, test, type Page } from "@playwright/test";

const ROOM_STATE_HEADING = "Состояние комнаты";

async function createRoom(page: Page, hostName: string): Promise<string> {
  await page.goto("/");
  await page.getByLabel("Имя host").fill(hostName);
  await page.getByRole("button", { name: "Создать" }).click();

  await expect(
    page.getByRole("heading", { name: ROOM_STATE_HEADING }),
  ).toBeVisible();
  const roomId = (
    await page.locator(".room-copy-field code").first().textContent()
  )?.trim();
  if (!roomId) {
    throw new Error("Room id was not rendered after creating the room");
  }
  return roomId;
}

async function joinRoom(
  page: Page,
  roomId: string,
  guestName: string,
): Promise<void> {
  await page.goto("/");
  await page.getByLabel("Invite-ссылка или ID комнаты").fill(roomId);
  await page.getByLabel("Имя гостя").fill(guestName);
  await page.getByRole("button", { name: "Войти" }).click();

  await expect(
    page.getByRole("heading", { name: ROOM_STATE_HEADING }),
  ).toBeVisible();
}

async function sendChat(page: Page, text: string): Promise<void> {
  await page.getByLabel("Сообщение в чат").fill(text);
  await page.getByRole("button", { name: "Отправить" }).click();
}

test("host and two guests: presence and chat propagate across all clients", async ({
  browser,
}) => {
  // Separate contexts model three independent browsers (independent session cookies).
  const hostContext = await browser.newContext();
  const guestOneContext = await browser.newContext();
  const guestTwoContext = await browser.newContext();

  try {
    const host = await hostContext.newPage();
    const guestOne = await guestOneContext.newPage();
    const guestTwo = await guestTwoContext.newPage();

    const roomId = await createRoom(host, "Host");
    await joinRoom(guestOne, roomId, "Guest One");
    await joinRoom(guestTwo, roomId, "Guest Two");

    // Presence fan-out: every client converges on three participants.
    for (const page of [host, guestOne, guestTwo]) {
      await expect(page.getByText("3/4")).toBeVisible();
    }

    // A guest message reaches the host and the other guest (and echoes to the sender).
    await sendChat(guestOne, "Привет от гостя");
    for (const page of [host, guestTwo, guestOne]) {
      await expect(page.getByText("Привет от гостя")).toBeVisible();
    }

    // The host reply reaches both guests.
    await sendChat(host, "Привет от хоста");
    for (const page of [guestOne, guestTwo]) {
      await expect(page.getByText("Привет от хоста")).toBeVisible();
    }
  } finally {
    await hostContext.close();
    await guestOneContext.close();
    await guestTwoContext.close();
  }
});
