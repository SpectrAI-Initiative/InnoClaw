# Generic Kubernetes Job Scheduler

The generic scheduler lets agents create standard Kubernetes `batch/v1 Job` resources from structured inputs. It does not assume a GPU vendor, custom scheduler, PVC layout, registry, namespace, or CRD.

## Configuration

Use environment variables for a simple single-profile setup:

```bash
KUBECONFIG_PATH=/path/to/kubeconfig
K8S_CONTEXT=local-context
K8S_DEFAULT_NAMESPACE=default
K8S_ALLOWED_NAMESPACES=default
K8S_JOB_DEFAULT_IMAGE=python:3.12
```

Use `config/k8s-job-profiles.local.json` for private local profiles. Do not commit that file.

For shareable examples, use `config/k8s-job-profiles.example.json`. Keep private kubeconfig paths, contexts, image registries, namespaces, secret names, and storage names in the ignored local file only.

## Agent Flow

1. `prepareK8sJob` builds and dry-runs the Job.
2. The user reviews profile, namespace, image, command, resources, and `jobSpecHash`.
3. `runK8sJob` submits only when the hash matches and the user confirms.
4. `waitForK8sJob` waits for a terminal state.
5. `collectK8sJobLogs` collects bounded logs.
6. `cleanupK8sJob` deletes only InnoClaw-managed Jobs after confirmation.

## Local Smoke Test

Use a private profile and run a minimal command such as:

```json
{
  "profileId": "cpu-smoke",
  "jobName": "innoclaw-smoke-test",
  "command": ["python", "-c"],
  "args": ["print('innoclaw-k8s-smoke-ok')"]
}
```

The smoke report may include profile id, job name, namespace, terminal status, log tail, and cleanup result. It must not include kubeconfig contents, tokens, secret values, internal node names, private topology, or unredacted private image paths.
