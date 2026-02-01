# Generated manually

from django.db import migrations, models
import django.db.models.deletion
import json.encoder


class Migration(migrations.Migration):

    dependencies = [
        ('operations', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='Gate',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('code', models.CharField(max_length=32)),
                ('name', models.CharField(max_length=64)),
                ('kind', models.CharField(choices=[('I', 'Internal'), ('D', 'Deposit'), ('W', 'Withdraw'), ('E', 'Exchange'), ('C', 'CardProvider'), ('T', 'Transfer')], db_index=True, max_length=1)),
                ('status', models.CharField(choices=[('D', 'Draft'), ('A', 'Active'), ('P', 'Purged')], db_index=True, max_length=1)),
                ('data', models.JSONField(blank=True, default=dict, encoder=json.encoder.JSONEncoder)),
                ('credentials', models.JSONField(blank=True, encoder=json.encoder.JSONEncoder, null=True)),
            ],
            options={
                'db_table': 'operations_gate',
            },
        ),
        migrations.AddField(
            model_name='operation',
            name='gate',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='operations.gate'),
        ),
    ]
