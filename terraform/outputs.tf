output "region" {
  value       = var.region
  description = "GCloud Region"
}

output "project_id" {
  value       = var.project_id
  description = "GCloud Project ID"
}

output "kubernetes_cluster_name" {
  value       = google_container_cluster.primary.name
  description = "GKE Cluster Name"
}

output "kubernetes_cluster_host" {
  value       = google_container_cluster.primary.endpoint
  description = "GKE Cluster Host"
  sensitive   = true
}

output "kubernetes_cluster_ca_certificate" {
  value       = google_container_cluster.primary.master_auth.0.cluster_ca_certificate
  description = "GKE Cluster CA Certificate"
  sensitive   = true
}

output "service_account_email" {
  value       = google_service_account.kubernetes.email
  description = "Service Account Email"
}

output "vpc_network_name" {
  value       = google_compute_network.vpc.name
  description = "VPC Network Name"
}

output "subnet_name" {
  value       = google_compute_subnetwork.subnet.name
  description = "Subnet Name"
}