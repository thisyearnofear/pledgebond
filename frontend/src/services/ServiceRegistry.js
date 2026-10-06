/**
 * Service Registry
 *
 * Facade for the 4 first-class BFF-backed services (circle, github, lifi, solana).
 * These all route through Next.js API routes so secrets stay server-side.
 *
 * The remaining 15+ utilities under `services/` (BuilderCredentialService,
 * EthosService, FairScoreService, QvacService, SnsService, etc.) are imported
 * directly by their callers. They are not registered here on purpose: registering
 * them all would create a god-object facade that hides their actual dependencies
 * and makes test doubles harder to wire. If you need to look up a service by name,
 * use the explicit `getCircleService()` / `getGitHubService()` / `getLiFiService()`
 * / `getSolanaService()` accessors below.
 */

import { walletService } from "./walletService";
import { realGitHubService } from "./RealGitHubService";
import { realLiFiService } from "./RealLiFiService";
import { validateApiService } from "../config/publicConfig";

class ServiceRegistry {
  constructor() {
    this.services = new Map();
    this.initializeServices();
  }

  initializeServices() {
    // Register all services
    // Note: realGitHubService already uses BFF route /api/github
    // walletService uses BFF route /api/circle
    this.services.set("circle", walletService);
    this.services.set("github", realGitHubService);
    this.services.set("lifi", realLiFiService);
  }

  /**
   * Get a service instance
   */
  getService(name) {
    const service = this.services.get(name);
    if (!service) {
      throw new Error(`Service '${name}' not found`);
    }
    return service;
  }

  /**
   * Check if a service is available and configured
   */
  isServiceAvailable(name) {
    // For BFF services, availability is usually true as long as the server handles tokens
    try {
      const service = this.getService(name);
      if (typeof service.isConfigured === 'function') {
          return service.isConfigured();
      }
      return true; 
    } catch (error) {
      return false;
    }
  }

  /**
   * Get all available services
   */
  getAvailableServices() {
    const available = [];
    for (const [name] of this.services) {
      if (this.isServiceAvailable(name)) {
        available.push(name);
      }
    }
    return available;
  }

  /**
   * Get service status for all services
   */
  getServiceStatus() {
    const status = {};
    for (const [name] of this.services) {
      status[name] = {
        available: this.isServiceAvailable(name),
        configured: validateApiService(name),
      };
    }
    return status;
  }

  /**
   * Get Circle service
   */
  getCircleService() {
    return this.getService("circle");
  }

  /**
   * Get GitHub service
   */
  getGitHubService() {
    return this.getService("github");
  }

  /**
   * Get LiFi service
   */
  getLiFiService() {
    return this.getService("lifi");
  }

  /**
   * Health check for all services
   */
  async healthCheck() {
    const results = {};

    for (const [name, service] of this.services) {
      try {
        const isConfigured = validateApiService(name);
        results[name] = {
          configured: isConfigured,
          available: this.isServiceAvailable(name),
          status: "healthy",
        };

        // Try to ping service if it has a status/ping method
        if (name === 'circle' && typeof service.getStatus === 'function') {
            const status = await service.getStatus();
            results[name].ping = status.success ? "success" : "failed";
        }

        if (name === 'solana' && typeof service.getCluster === 'function') {
            results[name].cluster = service.getCluster();
        }
      } catch (error) {
        results[name] = {
          configured: false,
          available: false,
          status: "error",
          error: error.message,
        };
      }
    }

    return results;
  }
}

// Export singleton instance
export const serviceRegistry = new ServiceRegistry();
export default serviceRegistry;
