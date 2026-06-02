import crypto from 'node:crypto';

const jobs = new Map();
let currentJobId = null;

function publicJob(job) {
  return {
    id: job.id,
    status: job.status,
    mode: job.mode,
    dryRun: job.dryRun,
    progress: job.progress,
    result: job.result || null,
    error: job.error || null,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

export function hasRunningJob() {
  const job = currentJobId ? jobs.get(currentJobId) : null;
  return Boolean(job && job.status === 'running');
}

export function getCurrentJob() {
  const job = currentJobId ? jobs.get(currentJobId) : null;
  return job ? publicJob(job) : null;
}

export function getJob(jobId) {
  const job = jobs.get(jobId);
  return job ? publicJob(job) : null;
}

export function startSyncJob({ mode, dryRun, run }) {
  if (hasRunningJob()) {
    throw new Error('A sync process is already running.');
  }

  const job = {
    id: crypto.randomUUID(),
    status: 'running',
    mode,
    dryRun,
    progress: {
      total: 0,
      completed: 0,
      currentSku: null,
    },
    result: null,
    error: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  jobs.set(job.id, job);
  currentJobId = job.id;

  setImmediate(async () => {
    try {
      const result = await run((progress) => {
        job.progress = {
          ...job.progress,
          ...progress,
        };
        job.updatedAt = new Date().toISOString();
      });
      job.status = 'completed';
      job.result = result;
    } catch (error) {
      job.status = 'failed';
      job.error = error.message;
    } finally {
      job.updatedAt = new Date().toISOString();
      if (currentJobId === job.id) currentJobId = null;
    }
  });

  return publicJob(job);
}
