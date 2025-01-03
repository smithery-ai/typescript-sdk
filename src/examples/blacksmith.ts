import * as agent from "@smithery/mcp-agent"
import * as exa from "@smithery/mcp-exa"
import { Connection } from "@smithery/sdk"
import dotenv from "dotenv"
// import { Langfuse } from "langfuse"
import readline from "node:readline"
dotenv.config()

// const langfuse = new Langfuse()

// const trace = langfuse.trace({
// 	name: "blacksmith-cli",
// })

const systemPrompt = `\
You are a Typescript SDK generation agent. You aim is to generate a Model Context Protocol (MCP) npm library from API documentation. MCP is a protocol that enables secure connections between host applications and services. Full documentation at https://modelcontextprotocol.io/llms.txt.

You will have access to a list of existing MCPs in the "mcps/" directory, which you should use as reference on how to write an MCP.
You should delegate sub-tasks by invoking an LLM-agent. Delegating subtasks makes your job easier as you don't have to put worry about too many things at once.
Your MCP should be up to date to the latest version of any given API, which is available online. Make sure you do your research to figure out how to build MCP correctly. Recalling this from your memory without research is error-prone.

A well written MCP package:
- defines and exports a schema for the API using Zod
- exports a \`createServer\` function that takes a list of tools and returns an object of type \`Server\` from "@modelcontextprotocol/sdk/server/index.js".
- ensures the \`createServer\` function takes an optional parameter for any authentication if relevant. The server could be hosted elsewhere and not be accessible to the client, so the client will need to be able to pass in the API key to the server upon loading. The \`exa\` server has a good example of this.

Your output artifact should be a fully functional Typescript npm package that is installable with \`npm install\`.
`

// Add function to get user input
async function getUserInput(): Promise<string> {
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	})

	return new Promise((resolve) => {
		rl.question("You: ", (input) => {
			rl.close()
			resolve(input)
		})
	})
}

async function main() {
	const connection = await Connection.connect({
		agent: {
			server: agent.createServer(
				{
					fs: {
						stdio: {
							command: "npx",
							args: [
								"-y",
								"@modelcontextprotocol/server-filesystem",
								"../typescript-sdk/mcps",
							],
						},
					},
					exa: exa.createServer({
						apiKey: process.env.EXA_API_KEY as string,
					}),
				},
				{
					apiKey: process.env.ANTHROPIC_API_KEY as string,
					maxTokens: 4096,
					timeout: 60 * 10,
				},
			),
		},
	})
	try {
		console.log("What MCP are you trying to build? Describe in detail:")

		while (true) {
			const userPrompt = await getUserInput()
			if (!userPrompt) {
				console.log("exiting...")
				return
			}
			let response = await connection.callTools([
				{
					mcp: "agent",
					name: "run",
					arguments: {
						instruction: `${systemPrompt}\n${userPrompt}`,
					},
				},
			])

			console.log(JSON.stringify(response, null, 2))
			response = await connection.callTools(
				[
					{
						mcp: "agent",
						name: "get_result",
						arguments: {
							pid: JSON.parse((response[0].content as any)[0].text).pid,
							block: 60 * 10,
						},
					},
				],
				{
					timeout: 60 * 10 * 1000,
				},
			)
			console.log(JSON.stringify(response, null, 2))
		}
	} finally {
		// await langfuse.shutdownAsync()
	}
}

main()
