# run-databricks-notebook v0

# Overview
Given a Databricks notebook and cluster specification, this Action runs the notebook as a one-time Databricks Job
run (docs: 
[AWS](https://docs.databricks.com/dev-tools/api/latest/jobs.html#operation/JobsRunsSubmit) |
[Azure](https://redocly.github.io/redoc/?url=https://docs.microsoft.com/azure/databricks/_static/api-refs/jobs-2.1-azure.yaml#operation/JobsRunsSubmit) |
[GCP](https://docs.gcp.databricks.com/dev-tools/api/latest/jobs.html#operation/JobsRunsSubmit)) and awaits its completion:

- optionally installing libraries on the cluster before running the notebook
- optionally configuring permissions on the notebook run (e.g. granting other users permission to view results)
- optionally triggering the Databricks job run with a timeout
- optionally using a Databricks job run name
- setting the notebook output,
  job run ID, and job run page URL as Action output
- failing if the Databricks job run fails

You can use this Action to trigger code execution on Databricks for CI (e.g. on pull requests) or CD (e.g. on pushes
to master).  

# Prerequisites
To use this Action, you need a Databricks REST API token to trigger notebook execution and await completion. The API
token must be associated with a principal with the following permissions:
* Cluster permissions ([AWS](https://docs.databricks.com/security/access-control/cluster-acl.html#types-of-permissions) |
[Azure](https://docs.microsoft.com/en-us/azure/databricks/security/access-control/cluster-acl#types-of-permissions) |
[GCP](https://docs.gcp.databricks.com/security/access-control/cluster-acl.html)): Unrestricted cluster creation,
if running the notebook against a new cluster (recommended), or "Can restart" permission, if running the notebook
against an existing cluster.
* Workspace permissions ([AWS](https://docs.databricks.com/security/access-control/workspace-acl.html#folder-permissions) |
[Azure](https://docs.microsoft.com/en-us/azure/databricks/security/access-control/workspace-acl#--folder-permissions) |
[GCP](https://docs.gcp.databricks.com/security/access-control/workspace-acl.html#folder-permissions)):
  * If supplying `local-notebook-path` with one of the `git-commit`, `git-tag`, or `git-branch` parameters, no workspace
    permissions are required. However, your principal must have Git integration configured
    ([AWS](https://docs.databricks.com/repos/index.html#configure-your-git-integration-with-databricks) |
    [Azure](https://docs.microsoft.com/en-us/azure/databricks/repos/#--configure-your-git-integration-with-azure-databricks) |
    [GCP](https://docs.gcp.databricks.com/repos/index.html#configure-your-git-integration-with-databricks))
  * If supplying the `local-notebook-path` parameter, "Can manage" permissions on the directory specified by the
    `workspace-temp-dir` parameter (the `/tmp/databricks-github-actions` directory if `workspace-temp-dir` is unspecified).
  * If supplying the `workspace-notebook-path`  parameter, "Can read" permissions on the specified notebook.

We recommend that you store the Databricks REST API token in [GitHub Actions secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
to pass it into your GitHub Workflow. The following section lists recommended approaches for token creation by cloud.

## AWS
For security reasons, we recommend creating and using a Databricks service principal API token. You can
[create a service principal](https://docs.databricks.com/dev-tools/api/latest/scim/scim-sp.html#create-service-principal),
grant the Service Principal
[token usage permissions](https://docs.microsoft.com/en-us/azure/databricks/administration-guide/access-control/tokens#control-who-can-use-or-create-tokens),
and [generate an API token](https://docs.databricks.com/dev-tools/api/latest/token-management.html#operation/create-obo-token) on its behalf.

## Azure
For security reasons, we recommend using a Databricks service principal AAD token.

### Create an Azure Service Principal
You can:
* Install the [Azure CLI](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli)
* Run `az login` to authenticate with Azure
* Run `az ad sp create-for-rbac -n <your-service-principal-name> --sdk-auth --scopes /subscriptions/<azure-subscription-id>/resourceGroups/<resource-group-name> --sdk-auth --role contributor`,
  specifying the subscription and resource group of your Azure Databricks workspace, to create a service principal and client secret.
  Store the resulting JSON output as a GitHub Actions secret named e.g. `AZURE_CREDENTIALS`
* Get the application id of your new service principal by running `az ad sp show --id <clientId from previous command output>`, using
  the `clientId` field from the JSON output of the previous step.
* [Add your service principal](https://docs.microsoft.com/en-us/azure/databricks/dev-tools/api/latest/scim/scim-sp#add-service-principal) to your workspace. Use the
  `appId` output field of the previous step as the `applicationId` of the service principal in the `add-service-principal` payload.
* **Note**: The generated Azure token has a default life span of **60 minutes**.
  If you expect your Databricks notebook to take longer than 60 minutes to finish executing, then you must create a [token lifetime policy](https://docs.microsoft.com/en-us/azure/active-directory/develop/configure-token-lifetimes)
  and attach it to your service principal.

### Use the Service Principal in your GitHub Workflow
* Add the following steps to the start of your GitHub workflow.
  This will create a new AAD token and save its value in the `DATABRICKS_TOKEN`
  environment variable for use in subsequent steps.

  ```yaml
  - name: Log into Azure
    uses: Azure/login@v1
    with:
      creds: ${{ secrets.AZURE_CREDENTIALS }}
  - name: Generate and save AAD token
    id: generate-token
    run: |
      echo "DATABRICKS_TOKEN=$(az account get-access-token \
      --resource=2ff814a6-3304-4ab8-85cb-cd0e6f879c1d \
      --query accessToken -o tsv)" >> $GITHUB_ENV
  ```

## GCP
For security reasons, we recommend inviting a service user to your Databricks workspace and using their API token.
You can invite a [service user to your workspace](https://docs.gcp.databricks.com/administration-guide/users-groups/users.html#add-a-user),
log into the workspace as the service user, and [create a personal access token](https://docs.gcp.databricks.com/dev-tools/api/latest/authentication.html) 
to pass into your GitHub Workflow.
  
# Usage

See [action.yml](action.yml) for the latest interface and docs.

### Run a self-contained notebook
The workflow below runs a self-contained notebook as a one-time job.

Python library dependencies are declared in the notebook itself using
notebook-scoped libraries
([AWS](https://docs.databricks.com/libraries/notebooks-python-libraries.html) | 
[Azure](https://docs.microsoft.com/en-us/azure/databricks/libraries/notebooks-python-libraries) | 
[GCP](https://docs.gcp.databricks.com/libraries/notebooks-python-libraries.html)) 
 
```yaml
name: Run a notebook in the current repo on PRs

on:
  pull_request

env:
  DATABRICKS_HOST: https://adb-XXXX.XX.azuredatabricks.net

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repo
        uses: actions/checkout@v2
      # Obtain an AAD token and use it to run the notebook on Databricks
      # Note: If running on AWS or GCP, you can directly pass your service principal
      # token via the databricks-host input instead
      - name: Log into Azure
        uses: Azure/login@v1
        with:
          creds: ${{ secrets.AZURE_CREDENTIALS }}
      # Get an AAD token for the service principal,
      # and store it in the DATABRICKS_TOKEN environment variable for use in subsequent steps.
      # We set the `resource` parameter to the programmatic ID for Azure Databricks.
      # See https://docs.microsoft.com/en-us/azure/databricks/dev-tools/api/latest/aad/service-prin-aad-token#--get-an-azure-ad-access-token for details.
      - name: Generate and save AAD token
        id: generate-token
        run: |
          echo "DATABRICKS_TOKEN=$(az account get-access-token \
          --resource=2ff814a6-3304-4ab8-85cb-cd0e6f879c1d \
          --query accessToken -o tsv)" >> $GITHUB_ENV
      - name: Trigger notebook from PR branch
        uses: databricks/run-databricks-notebook@v0
        with:
          local-notebook-path: notebooks/MainNotebook.py
          databricks-token: ${{ env.DATABRICKS_TOKEN }}
          # Alternatively, specify an existing-cluster-id to run against an existing cluster.
          # The cluter JSON below is for Azure Databricks. On AWS and GCP, set
          # node_type_id to an appropriate node type, e.g. "i3.xlarge" for
          # AWS or "n1-highmem-4" for GCP
          new-cluster-json: >
            {
              "num_workers": 1,
              "spark_version": "10.4.x-scala2.12",
              "node_type_id": "Standard_D3_v2"
            }
          # Grant all users view permission on the notebook results, so that they can
          # see the result of our CI notebook 
          access-control-list-json: >
            [
              {
                "group_name": "users",
                "permission_level": "CAN_VIEW"
              }
            ]
```

### Run a notebook using library dependencies in the current repo and on PyPI
In the workflow below, we build Python code in the current repo into a wheel, use ``upload-dbfs-temp`` to upload it to a
tempfile in DBFS, then run a notebook that depends on the wheel, in addition to other libraries publicly available on
PyPI. 

Databricks supports a range of library types, including Maven and CRAN. See 
the docs
([Azure](https://docs.microsoft.com/en-us/azure/databricks/dev-tools/api/latest/libraries#--library) |
[AWS](https://docs.databricks.com/dev-tools/api/latest/libraries.html#library) |
[GCP](https://docs.gcp.databricks.com/dev-tools/api/latest/libraries.html#library))

for more information.

```yaml
name: Run a single notebook on PRs

on:
  pull_request

env:
  DATABRICKS_HOST: https://adb-XXXX.XX.azuredatabricks.net
jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - name: Checks out the repo
        uses: actions/checkout@v2
      # Obtain an AAD token and use it to run the notebook on Databricks
      # Note: If running on AWS or GCP, you can directly pass your service principal
      # token via the databricks-host input instead
      - name: Log into Azure
        uses: Azure/login@v1
        with:
          creds: ${{ secrets.AZURE_CREDENTIALS }}
      # Get an AAD token for the service principal,
      # and store it in the DATABRICKS_TOKEN environment variable for use in subsequent steps.
      # We set the `resource` parameter to the programmatic ID for Azure Databricks.
      # See https://docs.microsoft.com/en-us/azure/databricks/dev-tools/api/latest/aad/service-prin-aad-token#--get-an-azure-ad-access-token for details.
      - name: Generate and save AAD token
        id: generate-token
        run: |
          echo "DATABRICKS_TOKEN=$(az account get-access-token \
          --resource=2ff814a6-3304-4ab8-85cb-cd0e6f879c1d \
          --query accessToken -o tsv)" >> $GITHUB_ENV
      - name: Setup python
        uses: actions/setup-python@v2
      - name: Build wheel
        run: |
          python setup.py bdist_wheel
      # Uploads local file (Python wheel) to temporary Databricks DBFS
      # path and returns path. See https://github.com/databricks/upload-dbfs-tempfile
      # for details.
      - name: Upload Wheel
        uses: databricks/upload-dbfs-temp@v0
        with:
          local-path: dist/my-project.whl
        id: upload_wheel
      - name: Trigger model training notebook from PR branch
        uses: databricks/run-databricks-notebook@v0
        with:
          local-notebook-path: notebooks/deployments/MainNotebook
          # Install the wheel built in the previous step as a library
          # on the cluster used to run our notebook
          libraries-json: >
            [
              { "whl": "${{ steps.upload_wheel.outputs.dbfs-file-path }}" },
              { "pypi": "mlflow" }
            ]
          # The cluster JSON below is for Azure Databricks. On AWS and GCP, set
          # node_type_id to an appropriate node type, e.g. "i3.xlarge" for
          # AWS or "n1-highmem-4" for GCP
          new-cluster-json: >
            {
              "num_workers": 1,
              "spark_version": "10.4.x-scala2.12",
              "node_type_id": "Standard_D3_v2"
            }
          # Grant all users view permission on the notebook results
          access-control-list-json: >
            [
              {
                "group_name": "users",
                "permission_level": "CAN_VIEW"
              }
            ]
```

### Run notebook within a temporary checkout of the current Repo
**Note**: This feature is in private preview. Please reach out to Databricks Support to request access.

The workflow below runs a notebook within a temporary repo checkout, enabled by
specifying the  `git-commit`, `git-branch`, or `git-tag` parameter. You can use this to run notebooks that
depend on other notebooks or files (e.g. Python modules in `.py` files) within the same repo
In the future, this will be our recommended approach for running notebooks using library dependencies in the
current repo.

```yaml
name: Run a notebook within its repo on PRs

on:
  pull_request

env:
  DATABRICKS_HOST: https://adb-XXXX.XX.azuredatabricks.net

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - name: Checks out the repo
        uses: actions/checkout@v2
      # Obtain an AAD token and use it to run the notebook on Databricks
      # Note: If running on AWS or GCP, you can directly pass your service principal
      # token via the databricks-host input instead
      - name: Log into Azure
        uses: Azure/login@v1
        with:
          creds: ${{ secrets.AZURE_CREDENTIALS }}
      # Get an AAD token for the service principal,
      # and store it in the DATABRICKS_TOKEN environment variable for use in subsequent steps.
      # We set the `resource` parameter to the programmatic ID for Azure Databricks.
      # See https://docs.microsoft.com/en-us/azure/databricks/dev-tools/api/latest/aad/service-prin-aad-token#--get-an-azure-ad-access-token for details.
      - name: Generate and save AAD token
        id: generate-token
        run: |
          echo "DATABRICKS_TOKEN=$(az account get-access-token \
          --resource=2ff814a6-3304-4ab8-85cb-cd0e6f879c1d \
          --query accessToken -o tsv)" >> $GITHUB_ENV
      - name: Trigger model training notebook from PR branch
        uses: databricks/run-databricks-notebook@v0
        with:
          # Run our notebook against a remote repo
          local-notebook-path: notebooks/deployments/MainNotebook
          git-commit: $GITHUB_SHA
          # The cluster JSON below is for Azure Databricks. On AWS and GCP, set
          # node_type_id to an appropriate node type, e.g. "i3.xlarge" for
          # AWS or "n1-highmem-4" for GCP
          new-cluster-json: >
            {
              "num_workers": 1,
              "spark_version": "10.4.x-scala2.12",
              "node_type_id": "Standard_D3_v2"
            }
          # Grant all users view permission on the notebook results
          access-control-list-json: >
            [
              {
                "group_name": "users",
                "permission_level": "CAN_VIEW"
              }
            ]
```

### Run notebooks in different Databricks Workspaces
In this example, we supply the `databricks-host` and `databricks-token` inputs
to each `run-databricks-notebook` step to trigger notebook execution against different workspaces.

```yaml
name: Run a notebook in the current repo on pushes to main

on:
  push
    branches:
      - main

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repo
        uses: actions/checkout@v2
      # Obtain an AAD token and use it to run the notebook on Databricks
      # Note: If running on AWS or GCP, you can directly pass your service principal
      # token via the databricks-host input instead
      - name: Log into Azure
        uses: Azure/login@v1
        with:
          creds: ${{ secrets.AZURE_STAGING_CREDENTIALS }}
      # Get an AAD token for the service principal,
      # and store it in the DATABRICKS_TOKEN environment variable for use in subsequent steps.
      # We set the `resource` parameter to the programmatic ID for Azure Databricks.
      # See https://docs.microsoft.com/en-us/azure/databricks/dev-tools/api/latest/aad/service-prin-aad-token#--get-an-azure-ad-access-token for details.
      - name: Generate and save AAD token
        id: generate-token
        run: |
          echo "DATABRICKS_STAGING_TOKEN=$(az account get-access-token \
          --resource=2ff814a6-3304-4ab8-85cb-cd0e6f879c1d \
          --query accessToken -o tsv)" >> $GITHUB_ENV
      - name: Trigger notebook in staging
        uses: databricks/run-databricks-notebook@v0
        with:
          databricks-host: https://adb-staging.XX.azuredatabricks.net
          databricks-token: ${{ env.DATABRICKS_STAGING_TOKEN }}
          local-notebook-path: notebooks/MainNotebook.py
          # The cluster JSON below is for Azure Databricks. On AWS and GCP, set
          # node_type_id to an appropriate node type, e.g. "i3.xlarge" for
          # AWS or "n1-highmem-4" for GCP
          new-cluster-json: >
            {
              "num_workers": 1,
              "spark_version": "10.4.x-scala2.12",
              "node_type_id": "Standard_D3_v2"
            }
          # Grant users in the "devops" group view permission on the
          # notebook results
          access-control-list-json: >
            [
              {
                "group_name": "devops",
                "permission_level": "CAN_VIEW"
              }
            ]
      # Obtain an AAD token and use it to run the notebook on Databricks
      # Note: If running on AWS or GCP, you can directly pass your service principal
      # token via the databricks-host input instead
      - name: Log into Azure
        uses: Azure/login@v1
        with:
          creds: ${{ secrets.AZURE_PROD_CREDENTIALS }}
      # Get an AAD token for the service principal,
      # and store it in the DATABRICKS_TOKEN environment variable for use in subsequent steps.
      # We set the `resource` parameter to the programmatic ID for Azure Databricks.
      # See https://docs.microsoft.com/en-us/azure/databricks/dev-tools/api/latest/aad/service-prin-aad-token#--get-an-azure-ad-access-token for details.
      - name: Generate and save AAD token
        id: generate-token
        run: |
          echo "DATABRICKS_PROD_TOKEN=$(az account get-access-token \
          --resource=2ff814a6-3304-4ab8-85cb-cd0e6f879c1d \
          --query accessToken -o tsv)" >> $GITHUB_ENV
      - name: Trigger notebook in prod
        uses: databricks/run-databricks-notebook@v0
        with:
          databricks-host: https://adb-prod.XX.azuredatabricks.net
          databricks-token: ${{ env.DATABRICKS_PROD_TOKEN }}
          local-notebook-path: notebooks/MainNotebook.py
          # The cluster JSON below is for Azure Databricks. On AWS and GCP, set
          # node_type_id to an appropriate node type, e.g. "i3.xlarge" for
          # AWS or "n1-highmem-4" for GCP
          new-cluster-json: >
            {
              "num_workers": 1,
              "spark_version": "10.4.x-scala2.12",
              "node_type_id": "Standard_D3_v2"
            }
          # Grant users in the "devops" group view permission on the
          # notebook results
          access-control-list-json: >
            [
              {
                "group_name": "devops",
                "permission_level": "CAN_VIEW"
              }
            ]
```

# Troubleshooting
To enable debug logging for Databricks REST API requests (e.g. to inspect the payload of a bad `/api/2.0/jobs/runs/submit`
Databricks REST API request), you can set the `ACTIONS_STEP_DEBUG` action secret to
`true`.
See [Step Debug Logs](https://github.com/actions/toolkit/blob/master/docs/action-debugging.md#how-to-access-step-debug-logs) 
for further details.

# License

The scripts and documentation in this project are released under the [Apache License, Version 2.0](LICENSE).
