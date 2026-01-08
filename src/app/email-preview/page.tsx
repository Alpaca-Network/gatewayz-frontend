"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function EmailPreviewPage() {
  return (
    <div className="container max-w-4xl mx-auto py-12 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Welcome Email Template</h1>
        <p className="text-muted-foreground">Preview of the redesigned welcome email</p>
      </div>

      <Card className="p-8">
        {/* Email Preview */}
        <div style={{
          maxWidth: '600px',
          margin: '0 auto',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
          backgroundColor: '#ffffff',
        }}>
          {/* Header with Logo and Gradient */}
          <div style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            padding: '40px 20px',
            textAlign: 'center',
            borderRadius: '8px 8px 0 0',
          }}>
            <img
              src="/logo_black.svg"
              alt="Gatewayz"
              style={{
                width: '60px',
                height: '60px',
                marginBottom: '20px',
                filter: 'brightness(0) invert(1)',
              }}
            />
            <h1 style={{
              color: '#ffffff',
              fontSize: '32px',
              fontWeight: 'bold',
              margin: '0 0 10px 0',
            }}>
              Welcome to Gatewayz! 🚀
            </h1>
            <p style={{
              color: 'rgba(255, 255, 255, 0.9)',
              fontSize: '18px',
              margin: '0',
            }}>
              Your AI development journey starts now
            </p>
          </div>

          {/* Main Content */}
          <div style={{ padding: '40px 30px' }}>
            <p style={{
              fontSize: '16px',
              lineHeight: '1.6',
              color: '#374151',
              margin: '0 0 20px 0',
            }}>
              Hi there! 👋
            </p>

            <p style={{
              fontSize: '16px',
              lineHeight: '1.6',
              color: '#374151',
              margin: '0 0 30px 0',
            }}>
              Thanks for joining Gatewayz! We're excited to help you build amazing AI applications with access to 300+ models from leading providers like OpenAI, Anthropic, Google, and more.
            </p>

            {/* Trial Credits Box */}
            <div style={{
              backgroundColor: '#f0fdf4',
              border: '2px solid #86efac',
              borderRadius: '12px',
              padding: '24px',
              marginBottom: '30px',
              textAlign: 'center',
            }}>
              <div style={{
                fontSize: '48px',
                marginBottom: '10px',
              }}>
                🎉
              </div>
              <h2 style={{
                color: '#166534',
                fontSize: '24px',
                fontWeight: 'bold',
                margin: '0 0 8px 0',
              }}>
                $3 Trial Credits Added!
              </h2>
              <p style={{
                color: '#15803d',
                fontSize: '16px',
                margin: '0',
              }}>
                Start building immediately - no credit card required
              </p>
            </div>

            {/* Quick Start Steps */}
            <h3 style={{
              fontSize: '20px',
              fontWeight: 'bold',
              color: '#111827',
              margin: '0 0 20px 0',
            }}>
              🎯 Get Started in 3 Easy Steps
            </h3>

            <div style={{ marginBottom: '30px' }}>
              {/* Step 1 */}
              <div style={{
                display: 'flex',
                marginBottom: '20px',
                alignItems: 'flex-start',
              }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  backgroundColor: '#667eea',
                  color: '#ffffff',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  marginRight: '16px',
                  flexShrink: 0,
                }}>
                  1
                </div>
                <div>
                  <h4 style={{
                    fontSize: '16px',
                    fontWeight: '600',
                    color: '#111827',
                    margin: '0 0 6px 0',
                  }}>
                    Get Your API Key
                  </h4>
                  <p style={{
                    fontSize: '14px',
                    color: '#6b7280',
                    margin: '0',
                    lineHeight: '1.5',
                  }}>
                    Navigate to Settings → API Keys to generate your key
                  </p>
                </div>
              </div>

              {/* Step 2 */}
              <div style={{
                display: 'flex',
                marginBottom: '20px',
                alignItems: 'flex-start',
              }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  backgroundColor: '#667eea',
                  color: '#ffffff',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  marginRight: '16px',
                  flexShrink: 0,
                }}>
                  2
                </div>
                <div>
                  <h4 style={{
                    fontSize: '16px',
                    fontWeight: '600',
                    color: '#111827',
                    margin: '0 0 6px 0',
                  }}>
                    Choose Your Model
                  </h4>
                  <p style={{
                    fontSize: '14px',
                    color: '#6b7280',
                    margin: '0',
                    lineHeight: '1.5',
                  }}>
                    Browse 300+ AI models - GPT-4, Claude, Gemini, and more
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
              }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  backgroundColor: '#667eea',
                  color: '#ffffff',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  marginRight: '16px',
                  flexShrink: 0,
                }}>
                  3
                </div>
                <div>
                  <h4 style={{
                    fontSize: '16px',
                    fontWeight: '600',
                    color: '#111827',
                    margin: '0 0 6px 0',
                  }}>
                    Start Building
                  </h4>
                  <p style={{
                    fontSize: '14px',
                    color: '#6b7280',
                    margin: '0',
                    lineHeight: '1.5',
                  }}>
                    Make your first API call and bring your AI ideas to life
                  </p>
                </div>
              </div>
            </div>

            {/* CTA Button */}
            <div style={{ textAlign: 'center', margin: '30px 0' }}>
              <a
                href="https://beta.gatewayz.ai/settings/keys"
                style={{
                  display: 'inline-block',
                  backgroundColor: '#667eea',
                  color: '#ffffff',
                  padding: '14px 32px',
                  borderRadius: '8px',
                  textDecoration: 'none',
                  fontWeight: '600',
                  fontSize: '16px',
                  boxShadow: '0 4px 6px rgba(102, 126, 234, 0.25)',
                }}
              >
                Get Your API Key →
              </a>
            </div>

            {/* Features Grid */}
            <div style={{
              backgroundColor: '#f9fafb',
              borderRadius: '12px',
              padding: '24px',
              marginTop: '30px',
            }}>
              <h3 style={{
                fontSize: '18px',
                fontWeight: 'bold',
                color: '#111827',
                margin: '0 0 16px 0',
                textAlign: 'center',
              }}>
                ✨ What You Get With Gatewayz
              </h3>

              <div style={{ marginBottom: '12px' }}>
                <span style={{ fontSize: '18px', marginRight: '8px' }}>⚡</span>
                <strong style={{ color: '#111827' }}>One API</strong>
                <span style={{ color: '#6b7280' }}> - Access 300+ models with a single integration</span>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <span style={{ fontSize: '18px', marginRight: '8px' }}>💰</span>
                <strong style={{ color: '#111827' }}>Save Costs</strong>
                <span style={{ color: '#6b7280' }}> - Intelligent routing & caching reduce API costs</span>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <span style={{ fontSize: '18px', marginRight: '8px' }}>🚀</span>
                <strong style={{ color: '#111827' }}>Ship Faster</strong>
                <span style={{ color: '#6b7280' }}> - Test and compare models in real-time</span>
              </div>

              <div>
                <span style={{ fontSize: '18px', marginRight: '8px' }}>🛡️</span>
                <strong style={{ color: '#111827' }}>Built-in Reliability</strong>
                <span style={{ color: '#6b7280' }}> - Automatic failover & load balancing</span>
              </div>
            </div>

            {/* Helpful Resources */}
            <div style={{
              marginTop: '30px',
              paddingTop: '30px',
              borderTop: '1px solid #e5e7eb',
            }}>
              <h3 style={{
                fontSize: '18px',
                fontWeight: 'bold',
                color: '#111827',
                margin: '0 0 16px 0',
              }}>
                📚 Helpful Resources
              </h3>

              <div style={{ marginBottom: '10px' }}>
                <a href="https://docs.gatewayz.ai" style={{
                  color: '#667eea',
                  textDecoration: 'none',
                  fontSize: '15px',
                }}>
                  → Documentation & Guides
                </a>
              </div>

              <div style={{ marginBottom: '10px' }}>
                <a href="https://beta.gatewayz.ai/models" style={{
                  color: '#667eea',
                  textDecoration: 'none',
                  fontSize: '15px',
                }}>
                  → Browse AI Models
                </a>
              </div>

              <div style={{ marginBottom: '10px' }}>
                <a href="https://beta.gatewayz.ai/claude-code" style={{
                  color: '#667eea',
                  textDecoration: 'none',
                  fontSize: '15px',
                }}>
                  → Claude Code Integration Guide
                </a>
              </div>

              <div>
                <a href="https://discord.gg/TEZDnb9EHE" style={{
                  color: '#667eea',
                  textDecoration: 'none',
                  fontSize: '15px',
                }}>
                  → Join Our Discord Community
                </a>
              </div>
            </div>

            {/* Support */}
            <p style={{
              fontSize: '15px',
              lineHeight: '1.6',
              color: '#6b7280',
              margin: '30px 0 0 0',
              paddingTop: '20px',
              borderTop: '1px solid #e5e7eb',
            }}>
              Questions? We're here to help! Reply to this email or reach out to our support team anytime.
            </p>

            <p style={{
              fontSize: '15px',
              lineHeight: '1.6',
              color: '#374151',
              margin: '20px 0 0 0',
              fontWeight: '500',
            }}>
              Happy building! 🎨<br />
              The Gatewayz Team
            </p>
          </div>

          {/* Footer */}
          <div style={{
            backgroundColor: '#f9fafb',
            padding: '30px 20px',
            textAlign: 'center',
            borderRadius: '0 0 8px 8px',
          }}>
            <div style={{ marginBottom: '16px' }}>
              <a href="https://x.com/AlpacaNetworkAI" style={{
                display: 'inline-block',
                margin: '0 8px',
                color: '#6b7280',
                textDecoration: 'none',
              }}>
                Twitter
              </a>
              <span style={{ color: '#d1d5db' }}>•</span>
              <a href="https://discord.gg/TEZDnb9EHE" style={{
                display: 'inline-block',
                margin: '0 8px',
                color: '#6b7280',
                textDecoration: 'none',
              }}>
                Discord
              </a>
              <span style={{ color: '#d1d5db' }}>•</span>
              <a href="https://docs.gatewayz.ai" style={{
                display: 'inline-block',
                margin: '0 8px',
                color: '#6b7280',
                textDecoration: 'none',
              }}>
                Docs
              </a>
            </div>
            <p style={{
              fontSize: '13px',
              color: '#9ca3af',
              margin: '0',
              lineHeight: '1.5',
            }}>
              © 2025 Gatewayz. All rights reserved.<br />
              You're receiving this email because you signed up for Gatewayz.
            </p>
          </div>
        </div>
      </Card>

      {/* HTML Code Export */}
      <div className="mt-8">
        <h2 className="text-xl font-bold mb-4">HTML Email Code</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Copy this HTML to use in your email service (Sendgrid, AWS SES, etc.)
        </p>
        <Button
          onClick={() => {
            const htmlContent = document.querySelector('#email-html-code')?.textContent || '';
            navigator.clipboard.writeText(htmlContent);
            alert('HTML code copied to clipboard!');
          }}
        >
          Copy HTML Code
        </Button>
      </div>
    </div>
  );
}
