# Deployment Templates

This directory contains deployment templates and configurations for running Ansybl services in various environments.

## Contents

- **[docker-compose.yml](./docker-compose.yml)** - Docker Compose configuration for local development and deployment
- **[kubernetes/](./kubernetes/)** - Kubernetes manifests for container orchestration
  - `namespace.yaml` - Kubernetes namespace definition
  - `deployment.yaml` - Deployment configuration
  - `service.yaml` - Service definitions
  - `configmap.yaml` - Configuration management

## Quick Start

### Docker Compose

To deploy using Docker Compose:

```bash
docker-compose up -d
```

### Kubernetes

To deploy to a Kubernetes cluster:

```bash
kubectl apply -f kubernetes/namespace.yaml
kubectl apply -f kubernetes/configmap.yaml
kubectl apply -f kubernetes/deployment.yaml
kubectl apply -f kubernetes/service.yaml
```

## Documentation

For detailed deployment instructions, see the [deployment guide](../docs/deployment-guide.md).
