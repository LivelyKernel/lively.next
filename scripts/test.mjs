import { Octokit } from "octokit";

const octokit = new Octokit({
  auth: process.env.TOKEN
})

octokit.request('POST /repos/{owner}/{repo}/issues/{issue_number}/labels', {
  owner: 'LivelyKernel',
  repo: 'lively.next',
  issue_number: process.env.NUMBER,
  labels: [
    '🎯: feature branch'
  ]
}).then(res => {
  if (res.statusCode > 400) {
    console.log("❌ There was a problem.");
    process.exit(1);
  }
});