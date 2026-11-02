import { afterEach, describe, expect, it, vi } from "vitest";

import { createPluginRuntimeTestHost, type PluginRuntimeTestHost } from "@emdash-cms/plugin-test";

const SEND_URL = "https://api.marleyfetch.com/v1/send";

let host: PluginRuntimeTestHost | undefined;

afterEach(async () => {
	await host?.dispose();
	host = undefined;
});

const hostWithKey = async () => {
	vi.stubEnv("EMDASH_ENCRYPTION_KEY", `emdash_enc_v1_${"A".repeat(43)}`);
	host = await createPluginRuntimeTestHost();
	expect(await host.actions.plugin.updateSettings({ apiKey: "mf_live_test" })).toMatchObject({ success: true });
	expect(JSON.stringify(await host.inspect.settings.raw("apiKey"))).not.toContain("mf_live_test");
	return host;
};

describe("email:deliver", () => {
	it("sends the message through MarleyFetch with the saved API key", async () => {
		const host = await hostWithKey();
		await host.http.respond(SEND_URL, Response.json({ success: true, messageId: "<send-1@mid.marleyfetch.com>" }));

		await host.transport.invokeHook("email:deliver", {
			source: "contact-form",
			message: {
				to: "owner@example.com",
				cc: ["team@example.com"],
				replyTo: "visitor@example.com",
				subject: "New message",
				text: "Hello",
				html: "<p>Hello</p>",
			},
		});

		const [request] = host.http.requests();
		expect(request.method).toBe("POST");
		expect(request.headers.authorization).toBe("Bearer mf_live_test");
		expect(JSON.parse(new TextDecoder().decode(request.body))).toEqual({
			to: "owner@example.com",
			cc: ["team@example.com"],
			reply_to: "visitor@example.com",
			subject: "New message",
			text_body: "Hello",
			html_body: "<p>Hello</p>",
		});
	});

	it("fails with MarleyFetch's message when the send is rejected", async () => {
		const host = await hostWithKey();
		await host.http.respond(SEND_URL, Response.json({ code: "QUOTA_EXCEEDED", message: "Daily quota exceeded" }, { status: 429 }));

		await expect(
			host.transport.invokeHook("email:deliver", { source: "system", message: { to: "a@example.com", subject: "s", text: "t" } }),
		).rejects.toThrow(/Daily quota exceeded/);
	});

	it("fails without calling MarleyFetch when no API key is saved", async () => {
		host = await createPluginRuntimeTestHost();

		await expect(
			host.transport.invokeHook("email:deliver", { source: "system", message: { to: "a@example.com", subject: "s", text: "t" } }),
		).rejects.toThrow(/API key/);
		expect(host.http.requests()).toHaveLength(0);
	});
});
