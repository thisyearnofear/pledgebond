/**
 * Multi-step campaign creation form for developers
 * Sections: Basic Info → Budget → Requirements → Scenarios → Success & Eligibility
 */

import { useState, useEffect } from 'react';
import { sanitizeCampaign, validateCampaign } from '@/schemas/campaign';

const STEPS = [
  { id: 'basic', label: 'Basic Info', fields: ['title', 'description', 'projectId'] },
  { id: 'budget', label: 'Budget & Timeline', fields: ['budget.total', 'budget.perSubmission', 'deadline'] },
  { id: 'requirements', label: 'Test Requirements', fields: ['requirements'] },
  { id: 'scenarios', label: 'Test Scenarios', fields: ['testScenarios'] },
  { id: 'success', label: 'Success & Eligibility', fields: ['expectedOutcome', 'successMetrics', 'eligibility', 'maxSubmissions'] },
];

export default function CampaignForm({ initialData = null, onSave = null, projects = [] }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState(initialData || getDefaultFormData());
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState('');

  // Auto-save draft to localStorage
  useEffect(() => {
    const saveTimer = setTimeout(() => {
      localStorage.setItem('campaign_draft', JSON.stringify(formData));
    }, 1000);

    return () => clearTimeout(saveTimer);
  }, [formData]);

  // Load draft if available
  useEffect(() => {
    if (!initialData) {
      const saved = localStorage.getItem('campaign_draft');
      if (saved) {
        try {
          setFormData(JSON.parse(saved));
        } catch (e) {
          console.error('Failed to load draft:', e);
        }
      }
    }
  }, [initialData]);

  const handleChange = (field, value) => {
    setFormData(prev => {
      const updated = { ...prev };
      const keys = field.split('.');
      let obj = updated;

      for (let i = 0; i < keys.length - 1; i++) {
        if (!obj[keys[i]]) obj[keys[i]] = {};
        obj = obj[keys[i]];
      }

      obj[keys[keys.length - 1]] = value;
      return updated;
    });

    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => {
        const updated = { ...prev };
        delete updated[field];
        return updated;
      });
    }
  };

  const handleAddRequirement = () => {
    setFormData(prev => ({
      ...prev,
      requirements: [...(prev.requirements || []), { title: '', description: '', priority: 'medium' }]
    }));
  };

  const handleRemoveRequirement = (index) => {
    setFormData(prev => ({
      ...prev,
      requirements: prev.requirements.filter((_, i) => i !== index)
    }));
  };

  const handleAddScenario = () => {
    setFormData(prev => ({
      ...prev,
      testScenarios: [...(prev.testScenarios || []), {
        id: `scenario-${Date.now()}`,
        title: '',
        description: '',
        steps: [],
        expectedResult: ''
      }]
    }));
  };

  const handleAddStep = (scenarioIndex, step) => {
    setFormData(prev => ({
      ...prev,
      testScenarios: prev.testScenarios.map((scenario, i) =>
        i === scenarioIndex
          ? { ...scenario, steps: [...scenario.steps, step] }
          : scenario
      )
    }));
  };

  const handleRemoveStep = (scenarioIndex, stepIndex) => {
    setFormData(prev => ({
      ...prev,
      testScenarios: prev.testScenarios.map((scenario, i) =>
        i === scenarioIndex
          ? { ...scenario, steps: scenario.steps.filter((_, j) => j !== stepIndex) }
          : scenario
      )
    }));
  };

  const handleAddMetric = () => {
    setFormData(prev => ({
      ...prev,
      successMetrics: [...(prev.successMetrics || []), { name: '', target: '' }]
    }));
  };

  const handleRemoveMetric = (index) => {
    setFormData(prev => ({
      ...prev,
      successMetrics: prev.successMetrics.filter((_, i) => i !== index)
    }));
  };

  const validateStep = () => {
    const stepFields = STEPS[currentStep].fields;
    const stepData = {};

    stepFields.forEach(field => {
      const keys = field.split('.');
      let value = formData;
      keys.forEach(key => {
        value = value[key];
      });
      stepData[field] = value;
    });

    // Basic validation
    const stepErrors = {};

    switch (currentStep) {
      case 0: // Basic info
        if (!formData.title || formData.title.length < 5) {
          stepErrors.title = 'Title must be at least 5 characters';
        }
        if (!formData.description || formData.description.length < 20) {
          stepErrors.description = 'Description must be at least 20 characters';
        }
        if (!formData.projectId) {
          stepErrors.projectId = 'Please select a project';
        }
        break;

      case 1: // Budget
        if (!formData.budget?.total || formData.budget.total <= 0) {
          stepErrors['budget.total'] = 'Total budget must be greater than 0';
        }
        if (!formData.budget?.perSubmission || formData.budget.perSubmission <= 0) {
          stepErrors['budget.perSubmission'] = 'Per submission amount must be greater than 0';
        }
        if (formData.budget?.perSubmission > formData.budget?.total) {
          stepErrors['budget.perSubmission'] = 'Per submission cannot exceed total budget';
        }
        if (!formData.deadline) {
          stepErrors.deadline = 'Please set a deadline';
        }
        break;

      case 2: // Requirements
        if (!formData.requirements || formData.requirements.length === 0) {
          stepErrors.requirements = 'Add at least one requirement';
        } else {
          formData.requirements.forEach((req, idx) => {
            if (!req.title) {
              stepErrors[`requirements.${idx}.title`] = 'Title is required';
            }
            if (!req.description) {
              stepErrors[`requirements.${idx}.description`] = 'Description is required';
            }
          });
        }
        break;

      case 3: // Scenarios
        if (!formData.testScenarios || formData.testScenarios.length === 0) {
          stepErrors.testScenarios = 'Add at least one test scenario';
        } else {
          formData.testScenarios.forEach((scenario, idx) => {
            if (!scenario.title) {
              stepErrors[`testScenarios.${idx}.title`] = 'Title is required';
            }
            if (!scenario.steps || scenario.steps.length === 0) {
              stepErrors[`testScenarios.${idx}.steps`] = 'Add at least one step';
            }
          });
        }
        break;

      case 4: // Success & Eligibility
        if (!formData.expectedOutcome || formData.expectedOutcome.length < 10) {
          stepErrors.expectedOutcome = 'Expected outcome must be at least 10 characters';
        }
        break;
    }

    setErrors(stepErrors);
    return Object.keys(stepErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep()) {
      setCurrentStep(prev => Math.min(prev + 1, STEPS.length - 1));
    }
  };

  const handlePrev = () => {
    setCurrentStep(prev => Math.max(prev - 1, 0));
  };

  const handleSave = async () => {
    const validation = validateCampaign(formData);
    if (!validation.isValid) {
      setErrors({ form: validation.errors.join('; ') });
      return;
    }

    setSaving(true);
    try {
      const sanitized = sanitizeCampaign(formData);

      if (onSave) {
        await onSave(sanitized);
      }

      setSavedMessage('Campaign saved as draft');
      setTimeout(() => setSavedMessage(''), 3000);
    } catch (error) {
      setErrors({ form: error.message });
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    const validation = validateCampaign(formData);
    if (!validation.isValid) {
      setErrors({ form: validation.errors.join('; ') });
      return;
    }

    setSaving(true);
    try {
      const sanitized = sanitizeCampaign(formData);
      sanitized.status = 'open';

      if (onSave) {
        await onSave(sanitized, true);
      }

      setSavedMessage('Campaign published');
      setTimeout(() => setSavedMessage(''), 3000);
    } catch (error) {
      setErrors({ form: error.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      {/* Step Indicator */}
      <div className="mb-8">
        <div className="flex justify-between mb-4">
          {STEPS.map((step, index) => (
            <div key={step.id} className="flex items-center flex-1">
              <div
                className={`flex items-center justify-center w-10 h-10 rounded-full font-bold ${
                  index <= currentStep
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-300 text-gray-600 dark:bg-gray-600 dark:text-gray-300'
                }`}
              >
                {index + 1}
              </div>
              <div className="flex-1 h-0.5 mx-2 bg-gray-300 dark:bg-gray-600" />
            </div>
          ))}
        </div>
        <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          {STEPS[currentStep].label}
        </div>
      </div>

      {/* Error Display */}
      {errors.form && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm">
          {errors.form}
        </div>
      )}

      {/* Success Message */}
      {savedMessage && (
        <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-green-700 dark:text-green-300 text-sm">
          {savedMessage}
        </div>
      )}

      {/* Form Content */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
        {currentStep === 0 && <StepBasicInfo formData={formData} handleChange={handleChange} errors={errors} projects={projects} />}
        {currentStep === 1 && <StepBudget formData={formData} handleChange={handleChange} errors={errors} />}
        {currentStep === 2 && (
          <StepRequirements
            formData={formData}
            handleChange={handleChange}
            handleAddRequirement={handleAddRequirement}
            handleRemoveRequirement={handleRemoveRequirement}
            errors={errors}
          />
        )}
        {currentStep === 3 && (
          <StepScenarios
            formData={formData}
            handleChange={handleChange}
            handleAddScenario={handleAddScenario}
            handleAddStep={handleAddStep}
            handleRemoveStep={handleRemoveStep}
            errors={errors}
          />
        )}
        {currentStep === 4 && (
          <StepSuccess
            formData={formData}
            handleChange={handleChange}
            handleAddMetric={handleAddMetric}
            handleRemoveMetric={handleRemoveMetric}
            errors={errors}
          />
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="flex justify-between gap-4">
        <button
          onClick={handlePrev}
          disabled={currentStep === 0}
          className="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          Previous
        </button>

        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 border border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-50 dark:hover:bg-blue-900/20"
          >
            {saving ? 'Saving...' : 'Save Draft'}
          </button>

          {currentStep === STEPS.length - 1 ? (
            <button
              onClick={handlePublish}
              disabled={saving}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700"
            >
              {saving ? 'Publishing...' : 'Publish Campaign'}
            </button>
          ) : (
            <button
              onClick={handleNext}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Step Components
function StepBasicInfo({ formData, handleChange, errors, projects }) {
  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-semibold mb-2 text-gray-900 dark:text-white">
          Project
        </label>
        <select
          value={formData.projectId || ''}
          onChange={(e) => handleChange('projectId', e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Select a project</option>
          {projects.map(project => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
        {errors.projectId && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.projectId}</p>}
      </div>

      <div>
        <label className="block text-sm font-semibold mb-2 text-gray-900 dark:text-white">
          Campaign Title <span className="text-gray-500 dark:text-gray-400 text-xs">({formData.title?.length || 0}/100)</span>
        </label>
        <input
          type="text"
          value={formData.title || ''}
          onChange={(e) => handleChange('title', e.target.value.substring(0, 100))}
          placeholder="e.g., Frontend UI Testing Sprint"
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {errors.title && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.title}</p>}
      </div>

      <div>
        <label className="block text-sm font-semibold mb-2 text-gray-900 dark:text-white">
          Description <span className="text-gray-500 dark:text-gray-400 text-xs">({formData.description?.length || 0}/2000)</span>
        </label>
        <textarea
          value={formData.description || ''}
          onChange={(e) => handleChange('description', e.target.value.substring(0, 2000))}
          placeholder="Describe what you want testers to focus on..."
          rows="4"
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {errors.description && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.description}</p>}
      </div>
    </div>
  );
}

function StepBudget({ formData, handleChange, errors }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold mb-2 text-gray-900 dark:text-white">
            Total Budget (USDC)
          </label>
          <input
            type="number"
            value={formData.budget?.total || ''}
            onChange={(e) => handleChange('budget.total', parseFloat(e.target.value) || 0)}
            placeholder="1000"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {errors['budget.total'] && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors['budget.total']}</p>}
        </div>

        <div>
          <label className="block text-sm font-semibold mb-2 text-gray-900 dark:text-white">
            Per Submission (USDC)
          </label>
          <input
            type="number"
            value={formData.budget?.perSubmission || ''}
            onChange={(e) => handleChange('budget.perSubmission', parseFloat(e.target.value) || 0)}
            placeholder="50"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {errors['budget.perSubmission'] && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors['budget.perSubmission']}</p>}
        </div>
      </div>

      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm text-blue-700 dark:text-blue-300">
        Max submissions: {formData.budget?.total && formData.budget?.perSubmission ? Math.floor(formData.budget.total / formData.budget.perSubmission) : '–'}
      </div>

      <div>
        <label className="block text-sm font-semibold mb-2 text-gray-900 dark:text-white">
          Token Allocation (%)
        </label>
        <input
          type="number"
          min="0"
          max="100"
          value={formData.budget?.tokenAllocation || 0}
          onChange={(e) => handleChange('budget.tokenAllocation', parseFloat(e.target.value) || 0)}
          placeholder="10"
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">% of reward as token equity</p>
      </div>

      <div>
        <label className="block text-sm font-semibold mb-2 text-gray-900 dark:text-white">
          Deadline
        </label>
        <input
          type="date"
          value={formData.deadline ? formData.deadline.split('T')[0] : ''}
          onChange={(e) => handleChange('deadline', e.target.value ? new Date(e.target.value).toISOString() : '')}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {errors.deadline && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.deadline}</p>}
      </div>
    </div>
  );
}

function StepRequirements({ formData, handleChange, handleAddRequirement, handleRemoveRequirement, errors }) {
  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-600 dark:text-gray-400">What aspects should testers focus on?</p>

      {formData.requirements?.map((req, idx) => (
        <div key={idx} className="p-4 border border-gray-300 dark:border-gray-600 rounded-lg space-y-3">
          <input
            type="text"
            value={req.title}
            onChange={(e) => {
              const updated = [...formData.requirements];
              updated[idx].title = e.target.value;
              handleChange('requirements', updated);
            }}
            placeholder="Requirement title"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <textarea
            value={req.description}
            onChange={(e) => {
              const updated = [...formData.requirements];
              updated[idx].description = e.target.value;
              handleChange('requirements', updated);
            }}
            placeholder="Description"
            rows="2"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={req.priority}
            onChange={(e) => {
              const updated = [...formData.requirements];
              updated[idx].priority = e.target.value;
              handleChange('requirements', updated);
            }}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="low">Low Priority</option>
            <option value="medium">Medium Priority</option>
            <option value="high">High Priority</option>
          </select>
          <button
            onClick={() => handleRemoveRequirement(idx)}
            className="text-sm text-red-600 hover:text-red-700 dark:text-red-300 dark:hover:text-red-300"
          >
            Remove
          </button>
        </div>
      ))}

      <button
        onClick={handleAddRequirement}
        className="px-4 py-2 border border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-sm font-semibold"
      >
        + Add Requirement
      </button>

      {errors.requirements && <p className="text-sm text-red-600 dark:text-red-400">{errors.requirements}</p>}
    </div>
  );
}

function StepScenarios({ formData, handleChange, handleAddScenario, handleAddStep, handleRemoveStep, errors }) {
  const [newSteps, setNewSteps] = useState({});

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-600 dark:text-gray-400">Define step-by-step test scenarios</p>

      {formData.testScenarios?.map((scenario, idx) => (
        <div key={scenario.id} className="p-4 border border-gray-300 dark:border-gray-600 rounded-lg space-y-3">
          <input
            type="text"
            value={scenario.title}
            onChange={(e) => {
              const updated = [...formData.testScenarios];
              updated[idx].title = e.target.value;
              handleChange('testScenarios', updated);
            }}
            placeholder="Scenario title"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-900 dark:text-white">Steps</label>
            {scenario.steps.map((step, stepIdx) => (
              <div key={stepIdx} className="flex gap-2">
                <div className="flex-1 p-2 bg-gray-100 dark:bg-gray-700 rounded text-sm">{stepIdx + 1}. {step}</div>
                <button
                  onClick={() => handleRemoveStep(idx, stepIdx)}
                  className="px-2 py-1 text-red-600 hover:text-red-700 dark:text-red-300 dark:hover:text-red-300 text-sm"
                >
                  ×
                </button>
              </div>
            ))}

            <div className="flex gap-2">
              <input
                type="text"
                value={newSteps[idx] || ''}
                onChange={(e) => setNewSteps({ ...newSteps, [idx]: e.target.value })}
                placeholder="Enter step and press Add"
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={() => {
                  if (newSteps[idx]) {
                    handleAddStep(idx, newSteps[idx]);
                    setNewSteps({ ...newSteps, [idx]: '' });
                  }
                }}
                className="px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
              >
                Add
              </button>
            </div>
          </div>

          <textarea
            value={scenario.expectedResult}
            onChange={(e) => {
              const updated = [...formData.testScenarios];
              updated[idx].expectedResult = e.target.value;
              handleChange('testScenarios', updated);
            }}
            placeholder="Expected result"
            rows="2"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      ))}

      <button
        onClick={handleAddScenario}
        className="px-4 py-2 border border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-sm font-semibold"
      >
        + Add Test Scenario
      </button>

      {errors.testScenarios && <p className="text-sm text-red-600 dark:text-red-400">{errors.testScenarios}</p>}
    </div>
  );
}

function StepSuccess({ formData, handleChange, handleAddMetric, handleRemoveMetric, errors }) {
  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-semibold mb-2 text-gray-900 dark:text-white">
          Expected Outcome <span className="text-gray-500 dark:text-gray-400 text-xs">({formData.expectedOutcome?.length || 0}/1000)</span>
        </label>
        <textarea
          value={formData.expectedOutcome || ''}
          onChange={(e) => handleChange('expectedOutcome', e.target.value.substring(0, 1000))}
          placeholder="What constitutes a successful test?"
          rows="3"
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {errors.expectedOutcome && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.expectedOutcome}</p>}
      </div>

      <div>
        <label className="block text-sm font-semibold mb-3 text-gray-900 dark:text-white">Success Metrics</label>
        {formData.successMetrics?.map((metric, idx) => (
          <div key={idx} className="flex gap-2 mb-2">
            <input
              type="text"
              value={metric.name}
              onChange={(e) => {
                const updated = [...formData.successMetrics];
                updated[idx].name = e.target.value;
                handleChange('successMetrics', updated);
              }}
              placeholder="Metric name"
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white text-sm"
            />
            <input
              type="text"
              value={metric.target}
              onChange={(e) => {
                const updated = [...formData.successMetrics];
                updated[idx].target = e.target.value;
                handleChange('successMetrics', updated);
              }}
              placeholder="Target"
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white text-sm"
            />
            <button
              onClick={() => handleRemoveMetric(idx)}
              className="px-2 py-1 text-red-600 hover:text-red-700 dark:text-red-300 dark:hover:text-red-300 text-sm"
            >
              ×
            </button>
          </div>
        ))}
        <button
          onClick={handleAddMetric}
          className="mt-2 px-4 py-2 border border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-sm font-semibold"
        >
          + Add Metric
        </button>
      </div>

      <div>
        <label className="block text-sm font-semibold mb-2 text-gray-900 dark:text-white">Minimum Tester Level</label>
        <select
          value={formData.eligibility?.minLevel || 'beginner'}
          onChange={(e) => handleChange('eligibility.minLevel', e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="beginner">Beginner</option>
          <option value="intermediate">Intermediate</option>
          <option value="expert">Expert</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-semibold mb-2 text-gray-900 dark:text-white">Max Submissions</label>
        <input
          type="number"
          value={formData.maxSubmissions || 50}
          onChange={(e) => handleChange('maxSubmissions', parseInt(e.target.value) || 50)}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
    </div>
  );
}

function getDefaultFormData() {
  return {
    title: '',
    description: '',
    projectId: '',
    status: 'draft',
    deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    budget: {
      total: 0,
      perSubmission: 0,
      currency: 'USDC',
      tokenAllocation: 0,
    },
    requirements: [],
    testScenarios: [],
    expectedOutcome: '',
    successMetrics: [],
    maxSubmissions: 50,
    eligibility: {
      minLevel: 'beginner',
      requiredExperience: '',
      geographicRestrictions: [],
    },
  };
}
