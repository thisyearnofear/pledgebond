/**
 * Component Index
 * Centralized exports for clean imports throughout the application
 */

// Dashboard Components
export { default as EcosystemSection } from './dashboard/EcosystemSection';

// Project Components
export { 
  BaseProjectCard,
  ProjectPreviewCard,
  ProjectDetailCard,
  ProjectListItem,
  ProjectGridCard
} from './projects/ProjectCard';

// Common Components (re-export for convenience)
export { Card } from './common/Card';
export { default as Button } from './common/Button';
export { Input } from './common/Input';
export { Modal } from './common/Modal';
export { LoadingSpinner } from './common/LoadingStates';
export { Navbar, Footer } from './common/layout';
