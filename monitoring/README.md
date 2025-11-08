# Monitoring

This directory contains monitoring and observability configurations for Ansybl services.

## Contents

- **[prometheus.yml](./prometheus.yml)** - Prometheus monitoring configuration
- **[grafana/](./grafana/)** - Grafana dashboards and configurations
  - `dashboards/` - Pre-built Grafana dashboards for visualizing metrics
- **[rules/](./rules/)** - Alert rules and recording rules for Prometheus

## Overview

The monitoring stack includes:

- **Prometheus** - Metrics collection and storage
- **Grafana** - Metrics visualization and dashboards
- **Alert Rules** - Automated alerting for system health and performance

## Setup

1. Ensure Prometheus and Grafana are deployed (see [deployment templates](../deployment-templates/))
2. Configure Prometheus using the provided `prometheus.yml`
3. Import Grafana dashboards from the `grafana/dashboards/` directory
4. Load alert rules from the `rules/` directory

## Documentation

For troubleshooting monitoring issues, see the [troubleshooting guide](../docs/troubleshooting.md).
