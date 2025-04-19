
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function AccountSettings() {
  const { currentUser } = useAuth();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Account Settings</CardTitle>
        <CardDescription>
          Manage your account details and preferences
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="username">Username</Label>
          <div className="flex gap-2">
            <Input
              id="username"
              value={currentUser?.username || ''}
              disabled
            />
            <Button variant="outline" disabled>Change</Button>
          </div>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="flex gap-2">
            <Input
              id="password"
              type="password"
              value="********"
              disabled
            />
            <Button variant="outline" disabled>Change</Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Password changing will be available in a future update.
          </p>
        </div>
        
        <div className="pt-4 border-t">
          <h3 className="text-lg font-medium text-destructive mb-4">Danger Zone</h3>
          <p className="text-sm text-muted-foreground mb-4">
            These actions cannot be undone.
          </p>
          
          <div className="flex flex-col gap-4">
            <Button variant="outline" disabled>Clear All Transactions</Button>
            <Button variant="destructive" disabled>Delete Account</Button>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            These features will be available in a future update.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
