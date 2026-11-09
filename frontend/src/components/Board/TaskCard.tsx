import React from 'react';
import { Draggable } from '@hello-pangea/dnd';
import { Task, TaskPriority } from '../../types';
import { useSprintStore } from '../../store/useSprintStore';

interface TaskCardProps {
  task: Task;
  index: number;
}

export const TaskCard: React.FC<TaskCardProps> = ({ task, index }) => {
  const { openTaskDetail } = useSprintStore();

  const getPriorityBadge = (priority: TaskPriority) => {
    switch (priority) {
      case 'URGENT':
        return <span className="text-[10px] text-rose-500 dark:text-rose-400 font-medium">Urgent</span>;
      case 'HIGH':
        return <span className="text-[10px] text-amber-500 dark:text-amber-400 font-medium">High</span>;
      case 'MEDIUM':
        return <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium">Medium</span>;
      case 'LOW':
      default:
        return <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium">Low</span>;
    }
  };

  const getInitials = (name?: string) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Draggable draggableId={String(task.id)} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={() => openTaskDetail(task.id)}
          className={`rounded-lg p-3 mb-2 bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-800/80 cursor-grab active:cursor-grabbing select-none transition-all ${
            snapshot.isDragging
              ? 'shadow-lg border-zinc-400 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-850'
              : 'hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-xs'
          }`}
        >
          {/* Top row: ID & Points */}
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-mono text-[11px] text-zinc-400 dark:text-zinc-500">
              DEV-{task.id}
            </span>
            <div className="flex items-center gap-2">
              {getPriorityBadge(task.priority)}
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-mono">
                {task.story_points}pt
              </span>
            </div>
          </div>

          {/* Title */}
          <h4 className="text-xs font-medium text-zinc-800 dark:text-zinc-200 line-clamp-2 leading-snug mb-2">
            {task.title}
          </h4>

          {/* Bottom row: Assignee */}
          <div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-800/60 text-xs">
            <div className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400">
              <div
                title={task.assignee?.name || 'Unassigned'}
                className="w-5 h-5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-[10px] font-medium flex items-center justify-center border border-zinc-200 dark:border-zinc-700"
              >
                {getInitials(task.assignee?.name)}
              </div>
              <span className="text-[11px] truncate max-w-[120px]">
                {task.assignee?.name || 'Unassigned'}
              </span>
            </div>
          </div>
        </div>
      )}
    </Draggable>
  );
};
