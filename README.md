# Folarin DevOps CI/CD — Node.js Auth App (Docker → ECR → ECS via GitHub Actions)

**Author / Contact**: Folarin Favour Olaoluwapo (Medium: *folarin favour olaoluwapo*)
**Repo**: `cloudformation/ci-cd-pipeline-template` and root app files

---

## What this repo contains (personalized)

This repository holds the small Node.js + Express (Handlebars) authentication app I built **and** the infrastructure + CI/CD pieces we put together:

* App: Express + `express-handlebars` views (`register.hbs`, `index.hbs`)
* Persistence: DynamoDB table `Users`
* Container: `Dockerfile` to build the app image
* Registry: ECR repository `folarin-devops-practice` (CloudFormation creates it)
* Orchestration: ECS Fargate task + service (behind an ALB in the CloudFormation template)
* CI/CD: GitHub Actions workflow (`.github/workflows/deploy.yml`) — builds, tags, pushes to ECR and deploys to ECS
* IaC: CloudFormation template at `cloudformation/ci-cd-ecs-fargate.yaml` (cleaned & ready-to-use)

---

## Quick variables (replace these before you run any deploy commands)

```text
AWS_ACCOUNT_ID=938586302001        # replace if different
AWS_REGION=us-east-1
ECR_REPO=folarin-devops-practice
ECS_CLUSTER=folarin-devops-cluster
ECS_SERVICE=folarin-devops-service
```

---

## Prerequisites (local & AWS)

**Local**

* Node.js (v16+ recommended) and npm
* Docker
* Git (WebStorm is already configured)
* AWS CLI configured (`~/.aws/credentials`) OR `.env` with AWS keys for local runs

**AWS**

* IAM user or role with permissions for ECR, ECS, CloudFormation, DynamoDB, ALB
* (Recommended) GitHub Actions IAM user with limited permissions or GitHub OIDC (best practice)

---

## Local development (fast steps)

1. Install deps:

```bash
npm install
```

2. Run locally (nodemon):

```bash
# Make sure port 3000 is free (stop any running container)
npm run dev
# App runs at http://localhost:3000
```

3. Or run inside Docker (recommended to mirror production):

```bash
# Prepare .env (DO NOT commit it)
# .env example:
# AWS_ACCESS_KEY_ID=...
# AWS_SECRET_ACCESS_KEY=...
# AWS_REGION=us-east-1
# DDB_TABLE=Users
# SESSION_SECRET=change_me

docker build -t folarin-devops-practice .
docker run --env-file .env -p 3000:3000 --name fdp-local folarin-devops-practice
```

---

## Git & repo hygiene (important before pushing)

1. Add a `.gitignore` (if not present):

```gitignore
node_modules/
.env
.idea/
.vscode/
.DS_Store
npm-debug.log
```

2. If `node_modules` or `.idea` are already tracked, remove them from git index:

```bash
git rm -r --cached node_modules .idea
git add .gitignore
git commit -m "Cleanup: ignore node_modules, env, IDE files"
```

3. Stage and push your CloudFormation and README:

```bash
git add cloudformation/ci-cd-ecs-fargate.yaml README.md .github/workflows/deploy.yml
git commit -m "Add CF template, CI workflow and README (personalized)"
git push origin master    # or 'main' if your repo uses main
```

---

## GitHub Actions — secrets to add (Repository → Settings → Secrets)

Set the following **exact** secret names (values are case-sensitive):

* `AWS_ACCESS_KEY_ID` — IAM user key for GH Actions
* `AWS_SECRET_ACCESS_KEY`
* `AWS_ACCOUNT_ID` — e.g. `938586302001`
* `AWS_REGION` — e.g. `us-east-1`
* `ECR_REPOSITORY` — `folarin-devops-practice`
* `ECS_CLUSTER` — `folarin-devops-cluster`
* `ECS_SERVICE` — `folarin-devops-service`

> **Security note:** If possible, use short-lived credentials or GitHub OIDC role assumption to avoid long-lived keys.

---

## How CI/CD works (the flow we built)

1. Push to `master` (or `main`) → triggers GitHub Actions workflow `.github/workflows/deploy.yml`
2. Action checks out code → configures AWS creds → logs into ECR
3. Builds Docker image, tags it with commit SHA → pushes to ECR
4. Renders & registers an updated ECS task definition with the new image
5. Deploys to the ECS service (forces new deployment) — your app is replaced with zero-touch update

---

## How to test the pipeline (step-by-step)

1. Make a tiny code change (e.g. update the `<h1>` or `console.log` in `server.js`).
2. Commit & push:

```bash
git add .
git commit -m "Test CI/CD — small text change"
git push origin master
```

3. Open your repo → **Actions** tab → watch the workflow run:

   * Check the "Build, tag and push" step for `IMAGE_URI` printed
   * Check the "Deploy" step for `amazon-ecs-deploy-task-definition` output
4. After GitHub Actions finishes, go to **ECS → Clusters → folarin-devops-cluster → Services** and confirm a new deployment started.
5. Visit the ALB DNS (EC2 Console → Load Balancers → DNS name) or task Public IP if no ALB.

---

## Common troubleshooting (what we saw and fixes)

* **`UnrecognizedClientException: security token invalid`** → credentials wrong or expired. Fix: re-create IAM key / refresh session.
* **Docker push tag format error** → make sure `AWS_ACCOUNT_ID` secret is set; image URI must be `123456789012.dkr.ecr.us-east-1.amazonaws.com/repo:tag`.
* **Port 3000 already in use** → stop container (`docker stop <id>`) or run local dev on a different port.
* **401 Unauthorized on /signin** → check DynamoDB entries, bcrypt comparison, and that the app writes to the correct `Users` table in the expected region.
* **CSS / MIME errors** → ensure static files live in `/public` and `express.static('public')` is configured; CSS must return `text/css`.
* **No commits appear on GitHub** → run `git status`, `git add`, `git commit`, `git push` (we covered these commands above).

---

## CloudFormation usage (deploy the IaC)

Create the stack via AWS CLI:

```bash
aws cloudformation create-stack \
  --stack-name folarin-devops-stack \
  --template-body file://cloudformation/ci-cd-ecs-fargate.yaml \
  --capabilities CAPABILITY_NAMED_IAM \
  --region $AWS_REGION
```

Wait until stack status is `CREATE_COMPLETE`. The template will output ALB DNS, ECR repo URI, cluster/service names.

---

## Cost control & cleanup (do this when not using)

* Scale service to 0:

```bash
aws ecs update-service --cluster $ECS_CLUSTER --service $ECS_SERVICE --desired-count 0 --region $AWS_REGION
```

* Delete the stack (removes created infra):

```bash
aws cloudformation delete-stack --stack-name folarin-devops-stack --region $AWS_REGION
```

* Delete ECR repo (if needed):

```bash
aws ecr delete-repository --repository-name $ECR_REPO --force --region $AWS_REGION
```

* Delete DynamoDB (if disposable):

```bash
aws dynamodb delete-table --table-name Users --region $AWS_REGION
```
—
Folarin Favour Olaoluwapo
