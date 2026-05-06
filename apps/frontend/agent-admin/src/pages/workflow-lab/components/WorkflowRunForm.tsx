import { Play } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import type { WorkflowDefinition } from '../registry/workflow.registry';

interface WorkflowRunFormProps {
  workflow: WorkflowDefinition;
  onSubmit: (payload: Record<string, unknown>) => void;
  isRunning: boolean;
}

type WorkflowFieldValue = string | number;

function buildInitialValues(workflow: WorkflowDefinition): Record<string, WorkflowFieldValue> {
  return Object.fromEntries(workflow.fields.map(field => [field.name, field.defaultValue ?? ''])) as Record<
    string,
    WorkflowFieldValue
  >;
}

export function WorkflowRunForm({ workflow, onSubmit, isRunning }: WorkflowRunFormProps) {
  const [values, setValues] = useState<Record<string, WorkflowFieldValue>>(() => buildInitialValues(workflow));

  useEffect(() => {
    setValues(buildInitialValues(workflow));
  }, [workflow]);

  function handleChange(name: string, value: WorkflowFieldValue) {
    setValues(prev => ({ ...prev, [name]: value }));
  }

  function handleSelectChange(name: string, event: ChangeEvent<HTMLSelectElement>) {
    handleChange(name, event.target.value);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(workflow.mapFormToPayload(values));
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 rounded-2xl border border-border/70 bg-muted/30 px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">运行参数</p>
        <span className="text-xs text-muted-foreground">{workflow.fields.length} fields</span>
      </div>

      {workflow.fields.map(field => {
        const fieldId = `workflow-run-${workflow.id}-${field.name}`;
        const fieldValue = values[field.name] ?? '';
        return (
          <label key={field.name} htmlFor={fieldId} className="grid gap-1 text-xs text-muted-foreground">
            <span>
              {field.label}
              {field.required ? <span className="ml-1 text-destructive">*</span> : null}
            </span>
            {field.type === 'select' ? (
              <select
                id={fieldId}
                value={String(fieldValue)}
                required={field.required}
                disabled={isRunning}
                onChange={(event: ChangeEvent<HTMLSelectElement>) => handleSelectChange(field.name, event)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {(field.options ?? []).map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : (
              <Input
                id={fieldId}
                type={field.type === 'number' ? 'number' : 'text'}
                value={String(fieldValue)}
                required={field.required}
                disabled={isRunning}
                placeholder={field.placeholder}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  handleChange(field.name, field.type === 'number' ? Number(event.target.value) : event.target.value)
                }
              />
            )}
          </label>
        );
      })}

      <Button type="submit" disabled={isRunning} className="mt-1 w-full">
        <Play className="h-4 w-4" />
        {isRunning ? '运行中...' : '运行工作流'}
      </Button>
    </form>
  );
}
