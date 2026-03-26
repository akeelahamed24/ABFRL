import { useEffect, useMemo, useState } from 'react';
import { Layout } from '@/components/layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { communicationsAPI } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { PhoneCall, Volume2, VolumeX, RefreshCcw, Clock3 } from 'lucide-react';

const SCENARIO_LABELS = {
  cart_abandonment: 'Cart Abandonment',
  product_interest: 'Product Interest',
  order_update: 'Order Update',
  post_delivery_followup: 'Post-Delivery Follow-up',
};

const VoiceAgent = () => {
  const { user, isAuthenticated } = useAuth();
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [speakingId, setSpeakingId] = useState(null);

  const loadWorkflows = async () => {
    if (!user?.id) {
      setWorkflows([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await communicationsAPI.getUserCommunications(user.id);
      setWorkflows(data.call_workflows || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadWorkflows();
  }, [user?.id]);

  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const workflowGroups = useMemo(() => {
    return workflows.reduce((acc, workflow) => {
      const key = workflow.scenario || 'other';
      acc[key] = acc[key] || [];
      acc[key].push(workflow);
      return acc;
    }, {});
  }, [workflows]);

  const speakScript = (workflow) => {
    if (!('speechSynthesis' in window)) {
      return;
    }

    if (speakingId === workflow.call_workflow_id) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(workflow.script);
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.onend = () => setSpeakingId(null);
    utterance.onerror = () => setSpeakingId(null);
    setSpeakingId(workflow.call_workflow_id);
    window.speechSynthesis.speak(utterance);
  };

  return (
    <Layout>
      <div className="container py-8 md:py-12 space-y-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.25em] text-muted-foreground">Simulation Console</p>
            <h1 className="font-serif text-4xl md:text-5xl">AI Calling Agent</h1>
            <p className="text-muted-foreground mt-3 max-w-2xl">
              Review the simulated outbound call workflows generated from cart behavior, product interest, delivery milestones, and post-delivery follow-ups.
            </p>
          </div>
          <Button variant="outline" onClick={() => void loadWorkflows()} disabled={loading}>
            <RefreshCcw className="h-4 w-4 mr-2" /> Refresh Workflows
          </Button>
        </div>

        {!isAuthenticated ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Sign in to review the simulated calling workflows tied to your commerce journey.
            </CardContent>
          </Card>
        ) : loading ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Loading voice workflows...
            </CardContent>
          </Card>
        ) : workflows.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No simulated call workflows are queued yet. Browse products, leave items in your cart, or place an order to trigger them.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            {Object.entries(workflowGroups).map(([scenario, scenarioWorkflows]) => (
              <Card key={scenario}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PhoneCall className="h-5 w-5 text-brand-orange" />
                    {SCENARIO_LABELS[scenario] || scenario}
                  </CardTitle>
                  <CardDescription>
                    {scenarioWorkflows.length} workflow{scenarioWorkflows.length === 1 ? '' : 's'} generated from shared order and activity state.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {scenarioWorkflows.map((workflow) => (
                    <div key={workflow.call_workflow_id} className="rounded-lg border border-border p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="secondary">{workflow.tone}</Badge>
                            <Badge variant={workflow.status === 'ready' ? 'default' : 'secondary'}>
                              {workflow.status}
                            </Badge>
                            {workflow.order_number && <Badge variant="outline">#{workflow.order_number}</Badge>}
                          </div>
                          <p className="text-sm text-muted-foreground flex items-center gap-2">
                            <Clock3 className="h-4 w-4" />
                            Scheduled for {new Date(workflow.scheduled_for).toLocaleString()}
                          </p>
                        </div>
                        <Button variant="outline" onClick={() => speakScript(workflow)}>
                          {speakingId === workflow.call_workflow_id ? (
                            <>
                              <VolumeX className="h-4 w-4 mr-2" /> Stop Playback
                            </>
                          ) : (
                            <>
                              <Volume2 className="h-4 w-4 mr-2" /> Play Script
                            </>
                          )}
                        </Button>
                      </div>
                      <div className="mt-4 rounded-md bg-muted/40 p-4">
                        <p className="text-sm leading-6 whitespace-pre-wrap">{workflow.script}</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default VoiceAgent;
