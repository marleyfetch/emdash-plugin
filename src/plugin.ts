import type { SandboxedPlugin } from "emdash/plugin";

const plugin: SandboxedPlugin = {
	hooks: {
		"email:deliver": {
			exclusive: true,
			handler: async ({ message }, ctx) => {
				const apiKey = await ctx.settings.get<string>("apiKey");
				if (!apiKey) throw new Error("MarleyFetch API key is not set. Add it in the plugin settings.");

				const response = await ctx.http!.fetch("https://api.marleyfetch.com/v1/send", {
					method: "POST",
					headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
					body: JSON.stringify({
						to: message.to,
						cc: message.cc,
						reply_to: message.replyTo,
						subject: message.subject,
						text_body: message.text,
						html_body: message.html,
					}),
				});
				if (!response.ok) throw new Error(`MarleyFetch rejected the email (${response.status}): ${await response.text()}`);
			},
		},
	},
};

export default plugin;
