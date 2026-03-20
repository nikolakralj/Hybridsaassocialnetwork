import { useState } from 'react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Database, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { migrateTimesheetEntries } from '../../utils/api/migrate-timesheets';

/**
 * Temporary migration component to add taskCategory and workType fields
 * to existing timesheet entries
 */
export function AddTaskFieldsMigration() {
  const [isLoading, setIsLoading] = useState(false);
  
  const handleMigrate = async () => {
    setIsLoading(true);
    try {
      const result = await migrateTimesheetEntries();
      toast.success(
        `Migration complete! Updated ${result.migrated} entries with task categories and work types`,
        { duration: 5000 }
      );
      // Reload to see changes
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error) {
      toast.error(`Migration failed: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <Card className="p-6 bg-blue-50 border-blue-200">
      <div className="flex items-start gap-4">
        <div className="p-2 bg-blue-100 rounded-lg">
          <Database className="h-6 w-6 text-blue-600" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 mb-1">
            Add Task Category & Work Type Fields
          </h3>
          <p className="text-sm text-gray-600 mb-3">
            Your existing timesheet entries don't have task category and work type data.
            Click the button below to add random sample data to all entries so you can see
            the new badges (blue for task categories, amber for special work types like overtime).
          </p>
          <Button
            onClick={handleMigrate}
            disabled={isLoading}
            className="gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Migrating Data...
              </>
            ) : (
              <>
                <Database className="h-4 w-4" />
                Add Task Fields to All Entries
              </>
            )}
          </Button>
        </div>
      </div>
    </Card>
  );
}
