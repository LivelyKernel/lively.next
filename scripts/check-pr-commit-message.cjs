const { readFileSync } = require('node:fs');
const { emojifiedLength } = require('./commit-msg-length-emojis.js');

// CONTRIBUTING.md owns the package mapping and its order.
const packages = new Map([...readFileSync(`${__dirname}/../CONTRIBUTING.md`, 'utf8')
  .matchAll(/^- ([\w./-]+): (\S+)$/gm)].map(([, name, emoji]) => [name, emoji]));
const checkName = 'Lively commit message';

function expectedPrefix (paths) {
  const affected = new Set(paths.map(path => {
    const directory = path.split('/')[0];
    const name = directory === 'lively.app' ? 'installer'
      : directory === 'lively-system-interface' ? 'system-interface'
        : directory.replace(/^lively\./, '');
    return path === 'README.md' ? packages.get('README')
      : packages.get(name) || packages.get('CI/scripts/docs');
  }));
  return [...packages.values()].filter(emoji => affected.has(emoji)).join('');
}

function validateSubject (subject, prefix, label) {
  if (!prefix || !subject.startsWith(`${prefix}: `)) {
    throw new Error(`${label} must start with "${prefix}: " (all affected packages, in order).`);
  }
  const summary = subject.slice(prefix.length + 2);
  if (!/^\p{Ll}/u.test(summary) || /[\r\n]/.test(subject)) {
    throw new Error(`${label} must contain a single-line summary starting with a lowercase letter.`);
  }
  if (summary.trim() === 'cleanup') throw new Error(`${label} needs more context than "cleanup".`);
  if (emojifiedLength(subject) >= 74) {
    throw new Error(`${label} exceeds the existing commit-message length limit.`);
  }
}

function validatePullRequest (pr, paths, number) {
  const prefix = expectedPrefix(paths);
  validateSubject(pr.title, prefix, 'PR title');
  // GitHub's default squash subject includes the PR number.
  validateSubject(`${pr.title} (#${number})`, prefix, 'Default squash subject');
  if (pr.autoMergeRequest) {
    if (pr.autoMergeRequest.mergeMethod !== 'SQUASH') {
      throw new Error('Auto-merge must use squash merging.');
    }
    validateSubject(pr.autoMergeRequest.commitHeadline, prefix, 'Queued auto-merge subject');
  }
  return prefix;
}

async function checkPullRequest (github, context, number) {
  if (!Number.isSafeInteger(number) || number < 1) throw new Error('A positive PR number is required.');
  const query = `query($owner: String!, $repo: String!, $number: Int!) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $number) {
        title state headRefOid changedFiles
        autoMergeRequest { commitHeadline mergeMethod }
      }
    }
  }`;
  const readPullRequest = async () => (await github.graphql(query, {
    owner: context.repo.owner, repo: context.repo.repo, number
  })).repository.pullRequest;
  const pr = await readPullRequest();
  if (pr.state !== 'OPEN') return;
  const { data: check } = await github.rest.checks.create({
    ...context.repo, name: checkName, head_sha: pr.headRefOid, status: 'in_progress',
    details_url: `${context.serverUrl}/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId}`
  });
  let prefix, error;
  try {
    const files = await github.paginate(github.rest.pulls.listFiles, {
      ...context.repo, pull_number: number, per_page: 100
    });
    if (files.length !== pr.changedFiles) throw new Error('Could not read the complete PR file list.');
    prefix = validatePullRequest(pr, files.flatMap(file =>
      file.previous_filename ? [file.filename, file.previous_filename] : [file.filename]), number);
    if (JSON.stringify(await readPullRequest()) !== JSON.stringify(pr)) {
      throw new Error('PR metadata changed during validation; rerun this check.');
    }
  } catch (err) { error = err; }
  await github.rest.checks.update({
    ...context.repo, check_run_id: check.id, status: 'completed',
    conclusion: error ? 'failure' : 'success',
    output: {
      title: error ? 'Fix the PR or queued merge subject' : 'Merge subject follows Lively conventions',
      summary: error ? error.message : `Required prefix: ${prefix}: `
    }
  });
  if (error) throw error;
}

module.exports = { expectedPrefix, validateSubject, validatePullRequest, checkPullRequest };
