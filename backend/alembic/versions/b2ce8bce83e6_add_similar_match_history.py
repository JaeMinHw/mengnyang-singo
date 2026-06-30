"""add similar match history

Revision ID: b2ce8bce83e6
Revises: 686452fc1ee7
Create Date: 2026-06-29 08:06:43.164629

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b2ce8bce83e6'
down_revision: Union[str, None] = '686452fc1ee7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'similar_match_history',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('source_sighting_id', sa.BigInteger(), nullable=False),
        sa.Column('target_sighting_id', sa.BigInteger(), nullable=False),
        sa.Column('recipient_user_id', sa.BigInteger(), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['recipient_user_id'], ['user.id']),
        sa.ForeignKeyConstraint(['source_sighting_id'], ['sighting.id']),
        sa.ForeignKeyConstraint(['target_sighting_id'], ['sighting.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint(
            'source_sighting_id',
            'target_sighting_id',
            'recipient_user_id',
            name='uq_similar_match_history'
        )
    )


def downgrade() -> None:
    op.drop_table('similar_match_history')
