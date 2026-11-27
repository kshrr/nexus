import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/useAuth';
import { Alert, Button, Card, Input } from '@/components/ui';
import { collectMyData, deleteMyAccount, downloadJson } from '@/lib/accountData';

const CONFIRM_WORD = 'DELETE';

/** Download a copy of your data, or permanently delete your account. */
export function DataControls() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const isAdmin = profile?.role === 'admin';

  async function onDownload() {
    setExportError('');
    setExporting(true);
    const { data, error } = await collectMyData(user);
    setExporting(false);
    if (error) {
      setExportError('We couldn’t collect your data just now. Please try again.');
      return;
    }
    downloadJson(`nexus-my-data-${new Date().toISOString().slice(0, 10)}.json`, data);
  }

  async function onDelete() {
    setDeleteError('');
    setDeleting(true);
    const { error } = await deleteMyAccount();
    if (error) {
      setDeleting(false);
      setDeleteError('We couldn’t delete your account just now. Nothing was removed. Try again.');
      return;
    }
    await signOut();
    navigate('/', { replace: true });
  }

  return (
    <Card variant="titled" title="Your data">
      <div className="flex flex-col gap-6">
        <section className="flex flex-col gap-2">
          <h4 className="text-h4">Download a copy</h4>
          <p className="text-body-sm text-ink-700">
            A file with your profile, SPM results, interest results, recommendations, saved items
            and chat history.
          </p>
          {exportError && <Alert variant="error">{exportError}</Alert>}
          <Button
            variant="secondary"
            size="sm"
            className="w-fit"
            onClick={onDownload}
            loading={exporting}
          >
            Download my data
          </Button>
        </section>

        <section className="flex flex-col gap-2 border-t border-ink-300 pt-5">
          <h4 className="text-h4">Delete my account</h4>
          <p className="text-body-sm text-ink-700">
            This permanently deletes your account and everything above. It can’t be undone.
          </p>
          {isAdmin ? (
            <Alert variant="info">Admin accounts can’t be deleted from here.</Alert>
          ) : !confirming ? (
            <Button
              variant="destructive"
              size="sm"
              className="w-fit"
              onClick={() => setConfirming(true)}
            >
              Delete my account
            </Button>
          ) : (
            <div className="flex flex-col gap-3 rounded-card border border-rust-600 p-4">
              <Input
                label={`Type ${CONFIRM_WORD} to confirm`}
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
                autoComplete="off"
              />
              {deleteError && <Alert variant="error">{deleteError}</Alert>}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={onDelete}
                  disabled={typed.trim() !== CONFIRM_WORD}
                  loading={deleting}
                >
                  Permanently delete my account
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={deleting}
                  onClick={() => {
                    setConfirming(false);
                    setTyped('');
                    setDeleteError('');
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </section>
      </div>
    </Card>
  );
}

export default DataControls;
