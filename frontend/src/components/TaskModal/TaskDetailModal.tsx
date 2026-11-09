import React, { useState } from 'react';
import {
  X,
  History,
  MessageSquare,
  Send,
  Trash2,
} from 'lucide-react';
import { useSprintStore } from '../../store/useSprintStore';
import { useAuthStore } from '../../store/useAuthStore';
import { TaskStatus, TaskPriority } from '../../types';

export const TaskDetailModal: React.FC = () => {
  const {
    selectedTaskDetail,
    selectedTaskId,
    closeTaskDetail,
    updateTask,
    deleteTask,
    addTaskComment,
    isLoadingTaskDetail,
  } = useSprintStore();
  const { teamMembers } = useAuthStore();

  const [activeTab, setActiveTab] = useState<'activity' | 'comments'>('activity');
  const [commentText, setCommentText] = useState('');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isSavingDesc, setIsSavingDesc] = useState(false);

  React.useEffect(() => {
    if (selectedTaskDetail) {
      setTitle(selectedTaskDetail.title);
      setDescription(selectedTaskDetail.description || '');
    }
  }, [selectedTaskDetail]);

  if (!selectedTaskId) return null;

  const handleSaveTitle = async () => {
    if (!title.trim() || title === selectedTaskDetail?.title) {
      setIsEditingTitle(false);
      return;
    }
    await updateTask(selectedTaskId, { title });
    setIsEditingTitle(false);
  };

  const handleSaveDescription = async () => {
    setIsSavingDesc(true);
    await updateTask(selectedTaskId, { description });
    setIsSavingDesc(false);
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    await addTaskComment(selectedTaskId, commentText.trim());
    setCommentText('');
  };

  const formatTimestamp = (ts: string) => {
    try {
      const d = new Date(ts);
      return d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return ts;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden transition-colors">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-zinc-400 dark:text-zinc-500 font-medium">
              DEV-{selectedTaskId}
            </span>
          </div>

          <button
            onClick={closeTaskDetail}
            className="p-1 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        {isLoadingTaskDetail || !selectedTaskDetail ? (
          <div className="p-10 text-center text-zinc-400 dark:text-zinc-500 text-xs">
            Loading...
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Main column */}
            <div className="md:col-span-2 space-y-4">
              {/* Title */}
              <div>
                {isEditingTitle ? (
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    onBlur={handleSaveTitle}
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveTitle()}
                    autoFocus
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-zinc-900 dark:text-white focus:outline-none"
                  />
                ) : (
                  <h3
                    onClick={() => setIsEditingTitle(true)}
                    className="text-base font-semibold text-zinc-900 dark:text-zinc-100 hover:text-black dark:hover:text-white cursor-pointer"
                  >
                    {selectedTaskDetail.title}
                  </h3>
                )}
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="Add details..."
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:border-zinc-400 dark:focus:border-zinc-700 rounded-lg p-2.5 text-xs text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none"
                />
                {description !== (selectedTaskDetail.description || '') && (
                  <div className="flex justify-end">
                    <button
                      onClick={handleSaveDescription}
                      disabled={isSavingDesc}
                      className="px-2.5 py-1 bg-zinc-900 dark:bg-zinc-100 hover:bg-black dark:hover:bg-white text-xs text-white dark:text-zinc-950 rounded font-medium"
                    >
                      {isSavingDesc ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                )}
              </div>

              {/* Activity / Comments Tabs */}
              <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center gap-4 mb-3 text-xs">
                  <button
                    onClick={() => setActiveTab('activity')}
                    className={`pb-1 font-medium ${
                      activeTab === 'activity'
                        ? 'text-zinc-900 dark:text-white border-b-2 border-zinc-900 dark:border-white'
                        : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                    }`}
                  >
                    Activity ({selectedTaskDetail.activities?.length || 0})
                  </button>

                  <button
                    onClick={() => setActiveTab('comments')}
                    className={`pb-1 font-medium ${
                      activeTab === 'comments'
                        ? 'text-zinc-900 dark:text-white border-b-2 border-zinc-900 dark:border-white'
                        : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                    }`}
                  >
                    Comments
                  </button>
                </div>

                {/* Activity list */}
                {activeTab === 'activity' && (
                  <div className="space-y-2 max-h-52 overflow-y-auto">
                    {selectedTaskDetail.activities && selectedTaskDetail.activities.length > 0 ? (
                      selectedTaskDetail.activities.map((act) => (
                        <div
                          key={act.id}
                          className="p-2 rounded bg-zinc-50 dark:bg-zinc-950/40 text-[11px] text-zinc-600 dark:text-zinc-400 border border-zinc-100 dark:border-zinc-800/40"
                        >
                          <div className="flex justify-between text-zinc-400 dark:text-zinc-500 mb-0.5">
                            <span className="text-zinc-700 dark:text-zinc-300 font-medium">{act.user?.name || 'System'}</span>
                            <span>{formatTimestamp(act.created_at)}</span>
                          </div>
                          <div className="text-zinc-800 dark:text-zinc-300">{act.message || act.change_type}</div>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-zinc-400 dark:text-zinc-500 py-2">No activity yet.</p>
                    )}
                  </div>
                )}

                {/* Comments list */}
                {activeTab === 'comments' && (
                  <div className="space-y-3">
                    <form onSubmit={handleAddComment} className="flex gap-2">
                      <input
                        type="text"
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        placeholder="Write a comment..."
                        className="flex-1 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md px-3 py-1.5 text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none"
                      />
                      <button
                        type="submit"
                        disabled={!commentText.trim()}
                        className="px-3 py-1.5 rounded-md bg-zinc-900 dark:bg-zinc-100 hover:bg-black dark:hover:bg-white text-white dark:text-zinc-950 text-xs font-medium disabled:opacity-50"
                      >
                        Send
                      </button>
                    </form>

                    <div className="space-y-2 max-h-44 overflow-y-auto">
                      {selectedTaskDetail.activities
                        ?.filter((a) => a.change_type === 'comment_added')
                        .map((c) => (
                          <div key={c.id} className="p-2.5 rounded bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-100 dark:border-zinc-800/60 text-xs">
                            <div className="flex justify-between text-[11px] text-zinc-400 dark:text-zinc-500 mb-1">
                              <span className="text-zinc-700 dark:text-zinc-300 font-medium">{c.user?.name}</span>
                              <span>{formatTimestamp(c.created_at)}</span>
                            </div>
                            <p className="text-zinc-800 dark:text-zinc-300">{c.message}</p>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Sidebar attributes */}
            <div className="space-y-3 text-xs bg-zinc-50 dark:bg-zinc-950/50 p-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800/80">
              <div>
                <label className="text-[11px] text-zinc-500 block mb-1">Status</label>
                <select
                  value={selectedTaskDetail.status}
                  onChange={(e) =>
                    updateTask(selectedTaskId, { status: e.target.value as TaskStatus })
                  }
                  className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded px-2 py-1.5 text-zinc-800 dark:text-zinc-200 focus:outline-none"
                >
                  <option value="TODO">To Do</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="IN_REVIEW">In Review</option>
                  <option value="DONE">Done</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] text-zinc-500 block mb-1">Priority</label>
                <select
                  value={selectedTaskDetail.priority}
                  onChange={(e) =>
                    updateTask(selectedTaskId, { priority: e.target.value as TaskPriority })
                  }
                  className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded px-2 py-1.5 text-zinc-800 dark:text-zinc-200 focus:outline-none"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] text-zinc-500 block mb-1">Story Points</label>
                <select
                  value={selectedTaskDetail.story_points}
                  onChange={(e) =>
                    updateTask(selectedTaskId, { story_points: Number(e.target.value) })
                  }
                  className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded px-2 py-1.5 text-zinc-800 dark:text-zinc-200 focus:outline-none"
                >
                  {[1, 2, 3, 5, 8, 13].map((pt) => (
                    <option key={pt} value={pt}>
                      {pt} points
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] text-zinc-500 block mb-1">Assignee</label>
                <select
                  value={selectedTaskDetail.assignee_id || ''}
                  onChange={(e) =>
                    updateTask(selectedTaskId, {
                      assignee_id: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded px-2 py-1.5 text-zinc-800 dark:text-zinc-200 focus:outline-none"
                >
                  <option value="">Unassigned</option>
                  {teamMembers.map((m) => (
                    <option key={m.user_id} value={m.user_id}>
                      {m.user?.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  onClick={() => {
                    if (confirm('Delete task?')) {
                      deleteTask(selectedTaskId);
                    }
                  }}
                  className="w-full py-1.5 text-xs text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded transition-colors text-center"
                >
                  Delete Task
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
